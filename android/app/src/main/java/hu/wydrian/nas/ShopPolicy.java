package hu.wydrian.nas;

import android.content.Context;
import org.json.JSONArray;
import org.json.JSONObject;
import java.net.URI;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/** Public domain policy, accepted only from our fixed bearer-authenticated TLS endpoint. No push-supplied grants. */
final class ShopPolicy {
    static final long MAX_AGE = 24 * 60 * 60 * 1000L;
    static Map<String, Set<String>> parse(JSONObject data) throws Exception {
        if (data.toString().length() > 32768 || data.getInt("version") != 1) throw new IllegalArgumentException("Policy version/size");
        JSONArray shops = data.getJSONArray("shops");
        if (shops.length() < 1 || shops.length() > 100) throw new IllegalArgumentException("Shop count");
        Map<String, Set<String>> result = new HashMap<>();
        for (int i = 0; i < shops.length(); i++) {
            JSONObject shop = shops.getJSONObject(i); String id = shop.getString("id"); JSONArray hosts = shop.getJSONArray("hosts");
            if (!id.matches("[a-z0-9]{1,40}") || result.containsKey(id) || hosts.length() < 1 || hosts.length() > 4) throw new IllegalArgumentException("Shop identity");
            Set<String> allowed = new HashSet<>();
            for (int j = 0; j < hosts.length(); j++) {
                String host = hosts.getString(j);
                if (host.length() > 253 || !host.matches("(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z]{2,63}") || host.endsWith(".localhost") || host.endsWith(".local") || !allowed.add(host)) throw new IllegalArgumentException("Host");
            }
            result.put(id, allowed);
        }
        return result;
    }
    static String safeCandidate(String shop, String value) {
        if (shop == null || !shop.matches("[a-z0-9]{1,40}") || value == null || value.length() > 4096) return null;
        try { URI uri = URI.create(value); return "https".equals(uri.getScheme()) && uri.getHost() != null && uri.getRawUserInfo() == null
                && (uri.getPort() == -1 || uri.getPort() == 443) ? value : null; }
        catch (Exception ignored) { return null; }
    }
    static String productUrl(Map<String, Set<String>> policy, String shop, String value) {
        if (safeCandidate(shop, value) == null) return null;
        Set<String> hosts = policy.get(shop);
        return hosts != null && hosts.contains(URI.create(value).getHost()) ? value : null;
    }
    static Map<String, Set<String>> cached(Context context) {
        var prefs = context.getSharedPreferences("shop-policy", Context.MODE_PRIVATE);
        long age = System.currentTimeMillis() - prefs.getLong("fetchedAt", 0);
        if (age < 0 || age >= MAX_AGE) return null;
        try { return parse(new JSONObject(prefs.getString("data", ""))); } catch (Exception ignored) { return null; }
    }
    static String productUrl(Context context, String shop, String value) {
        var policy = cached(context);
        // Offline bootstrap is limited to the previously reviewed built-in shops, never unknown domains.
        return policy == null ? UrlPolicy.productUrl(shop, value) : productUrl(policy, shop, value);
    }
    static boolean refresh(Context context, String secret) throws Exception {
        NasApi.Result response = NasApi.shops(secret);
        synchronized (ShopPolicy.class) {
            SecureStore store = new SecureStore(context);
            if (!secret.equals(store.get("secret"))) return false;
            if (response.status == 401) { clear(context); return false; }
            if (response.status != 200) return false;
            save(context, response.data); return true;
        }
    }
    static void save(Context context, JSONObject data) throws Exception {
        parse(data);
        if (!context.getSharedPreferences("shop-policy", Context.MODE_PRIVATE).edit().putString("data", data.toString()).putLong("fetchedAt", System.currentTimeMillis()).commit()) throw new IllegalStateException("Policy storage");
    }
    static synchronized void clear(Context context) { context.getSharedPreferences("shop-policy", Context.MODE_PRIVATE).edit().clear().commit(); }
}
