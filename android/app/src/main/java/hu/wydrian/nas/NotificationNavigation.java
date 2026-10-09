package hu.wydrian.nas;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import java.util.Map;

final class NotificationNavigation {
    private String product;
    private String shop;

    static Intent destination(Context context, Map<String, String> data, String event) {
        // Start our Activity directly, never a service/broadcast notification trampoline.
        Intent intent = new Intent(context, MainActivity.class)
                .setData(Uri.fromParts("wydrian-notification", event, null))
                .putExtra("path", UrlPolicy.notificationPath(data.get("path")))
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        // A new shop may not be cached yet. Keep only a safe candidate; it grants no launch permission.
        String id = data.get("shopId"), url = data.get("productUrl");
        if ("product".equals(data.get("kind")) && ShopPolicy.safeCandidate(id, url) != null) {
            intent.putExtra("kind", "product").putExtra("shopId", data.get("shopId")).putExtra("productUrl", data.get("productUrl"));
        }
        return intent;
    }

    void receive(Intent intent) {
        // Revalidate at the exported Activity boundary; consume extras to prevent replay on recreation.
        shop = intent.getStringExtra("shopId");
        product = "product".equals(intent.getStringExtra("kind"))
                ? ShopPolicy.safeCandidate(shop, intent.getStringExtra("productUrl")) : null;
        intent.removeExtra("kind"); intent.removeExtra("shopId"); intent.removeExtra("productUrl");
    }

    boolean openProduct(Activity activity) {
        String url = ShopPolicy.productUrl(activity, shop, product); product = null; shop = null;
        return url == null || BrowserLauncher.open(activity, url);
    }
    boolean needsPolicy(Context context) { return product != null && (ShopPolicy.cached(context) == null || ShopPolicy.productUrl(context, shop, product) == null); }
}
