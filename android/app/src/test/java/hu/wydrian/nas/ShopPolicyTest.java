package hu.wydrian.nas;

import android.app.Activity;
import android.content.Intent;
import android.content.Context;
import android.content.IntentFilter;
import android.content.pm.ActivityInfo;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import org.json.JSONObject;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import java.util.Map;
import java.util.List;
import static org.junit.Assert.*;
import static org.robolectric.Shadows.shadowOf;

@RunWith(RobolectricTestRunner.class)
@Config(manifest = Config.NONE, sdk = {26, 35})
public class ShopPolicyTest {
    private Activity activity;
    private static final String URL = "https://bloomrift.eu/pokemon-demo?variant=2#details";
    private static final String POLICY = "{\"version\":1,\"shops\":[{\"id\":\"bloomrift\",\"hosts\":[\"bloomrift.eu\",\"www.bloomrift.eu\"]}]}";
    @Before public void setup() { activity = Robolectric.buildActivity(Activity.class).create().resume().get(); ShopPolicy.clear(activity); }
    @Test public void futureShopAndExactWWWHostWorkWithoutChangingNativeRegistry() throws Exception {
        ShopPolicy.save(activity, new JSONObject(POLICY));
        assertEquals(URL, ShopPolicy.productUrl(activity, "bloomrift", URL));
        assertEquals(URL.replace("bloomrift.eu", "www.bloomrift.eu"), ShopPolicy.productUrl(activity,"bloomrift",URL.replace("bloomrift.eu", "www.bloomrift.eu")));
        ShopPolicy.save(activity,new JSONObject(POLICY.replace("bloomrift","futurecards").replace(".eu",".com")));
        assertEquals("https://futurecards.com/p",ShopPolicy.productUrl(activity,"futurecards","https://futurecards.com/p"));
        assertNull(ShopPolicy.productUrl(activity,"bloomrift",URL));
    }
    @Test public void schemeUserInfoPortLookalikeCrossShopAndUnknownAreDenied() throws Exception {
        var policy=ShopPolicy.parse(new JSONObject(POLICY));
        for(String url:new String[]{"http://bloomrift.eu/p","https://bloomrift.eu.evil.example/p","https://sub.bloomrift.eu/p","https://evil.example/p","https://u:p@bloomrift.eu/p","https://bloomrift.eu:444/p","intent://bloomrift.eu/p","javascript:alert(1)","https://bloomrift.eu\\@evil.example/p","https://bloomrift.eu./p"})assertNull(url,ShopPolicy.productUrl(policy,"bloomrift",url));
        assertNull(ShopPolicy.productUrl(policy,"unknown",URL));assertNull(ShopPolicy.productUrl(policy,"tcgbolt",URL));assertNull(ShopPolicy.safeCandidate(null,URL));assertNull(ShopPolicy.safeCandidate("Bad-Shop",URL));assertNull(ShopPolicy.safeCandidate("bloomrift","https://bloomrift.eu/"+"a".repeat(4096)));
        assertEquals("https://bloomrift.eu:443/p",ShopPolicy.productUrl(policy,"bloomrift","https://bloomrift.eu:443/p"));
    }
    @Test public void malformedPolicyNeverReplacesLastValidCache() throws Exception {
        ShopPolicy.save(activity,new JSONObject(POLICY));
        for(String data:new String[]{POLICY.replace("\"version\":1","\"version\":2"),"{\"version\":1,\"shops\":[]}",POLICY.replace("bloomrift.eu","*.bloomrift.eu"),POLICY.replace("bloomrift.eu","127.0.0.1"),POLICY.replace("bloomrift.eu","https://bloomrift.eu"),POLICY.replace("bloomrift.eu","bloomrift.eu:443"),POLICY.replace("bloomrift.eu","bloomrift.local"),POLICY.replace("bloomrift.eu","bloomrift.localhost"),POLICY.replace("bloomrift.eu","BLOOMRIFT.EU"),POLICY.replace("\"bloomrift\"","\"bad-id\"")}){
            try { ShopPolicy.save(activity,new JSONObject(data)); fail(data); } catch(Exception expected) {}
            assertEquals(URL,ShopPolicy.productUrl(activity,"bloomrift",URL));
        }
        var duplicate=new JSONObject(POLICY);duplicate.getJSONArray("shops").put(duplicate.getJSONArray("shops").getJSONObject(0));
        try { ShopPolicy.parse(duplicate);fail("duplicate shop"); } catch(Exception expected) {}
        var duplicateHost=new JSONObject(POLICY);duplicateHost.getJSONArray("shops").getJSONObject(0).getJSONArray("hosts").put("bloomrift.eu");
        try { ShopPolicy.parse(duplicateHost);fail("duplicate host"); } catch(Exception expected) {}
    }
    @Test public void expiredFutureDatedCorruptOrClearedCacheCannotGrantNewShop() throws Exception {
        ShopPolicy.save(activity,new JSONObject(POLICY));
        var prefs=activity.getSharedPreferences("shop-policy",Context.MODE_PRIVATE);
        prefs.edit().putLong("fetchedAt",System.currentTimeMillis()-ShopPolicy.MAX_AGE-1000).commit();assertNull(ShopPolicy.productUrl(activity,"bloomrift",URL));
        prefs.edit().putLong("fetchedAt",System.currentTimeMillis()+60000).commit();assertNull(ShopPolicy.productUrl(activity,"bloomrift",URL));
        prefs.edit().putString("data","broken").putLong("fetchedAt",System.currentTimeMillis()).commit();assertNull(ShopPolicy.productUrl(activity,"bloomrift",URL));
        ShopPolicy.save(activity,new JSONObject(POLICY));ShopPolicy.clear(activity);assertNull(ShopPolicy.productUrl(activity,"bloomrift",URL));
        assertEquals("https://tcgbolt.hu/p",ShopPolicy.productUrl(activity,"tcgbolt","https://tcgbolt.hu/p"));
    }
    @Test public void validCacheIsAuthoritativeEvenForPreviouslyBuiltInShops() throws Exception {
        ShopPolicy.save(activity,new JSONObject(POLICY));assertNull(ShopPolicy.productUrl(activity,"tcgbolt","https://tcgbolt.hu/p"));
        ShopPolicy.save(activity,new JSONObject("{\"version\":1,\"shops\":[{\"id\":\"tcgbolt\",\"hosts\":[\"new-reviewed-domain.hu\"]}]}"));
        assertNull(ShopPolicy.productUrl(activity,"tcgbolt","https://tcgbolt.hu/p"));assertEquals("https://new-reviewed-domain.hu/p",ShopPolicy.productUrl(activity,"tcgbolt","https://new-reviewed-domain.hu/p"));
    }
    @Test public void unknownNotificationIsDeferredNotAuthorizedByPushAndConsumedOnce() throws Exception {
        Intent intent=NotificationNavigation.destination(activity,Map.of("kind","product","shopId","bloomrift","productUrl",URL,"path","/pokemon#shop-bloomrift"),"future");
        assertEquals(URL,intent.getStringExtra("productUrl"));NotificationNavigation navigation=new NotificationNavigation();navigation.receive(intent);assertFalse(intent.hasExtra("productUrl"));assertTrue(navigation.needsPolicy(activity));
        assertTrue(navigation.openProduct(activity)); // Unknown candidate opens no browser and keeps internal fallback.
        assertEquals("/pokemon#shop-bloomrift",intent.getStringExtra("path"));assertFalse(navigation.needsPolicy(activity));
        navigation.receive(NotificationNavigation.destination(activity,Map.of("kind","product","shopId","bloomrift","productUrl",URL),"cache"));ShopPolicy.save(activity,new JSONObject(POLICY));assertFalse(navigation.needsPolicy(activity));
        assertFalse(navigation.openProduct(activity)); // No installed browser in this fixture; failure is reported only once.
        assertTrue(navigation.openProduct(activity));
    }
    @Test public void newlyGrantedShopOpensExactProductInBrowserOnceAfterDeferredRefresh() throws Exception {
        var recording=Robolectric.buildActivity(NotificationNavigationTest.RecordingActivity.class).create().resume().get();
        ResolveInfo browser=new ResolveInfo();browser.filter=new IntentFilter(Intent.ACTION_VIEW);browser.filter.addCategory(Intent.CATEGORY_DEFAULT);browser.filter.addCategory(Intent.CATEGORY_BROWSABLE);browser.filter.addDataScheme("https");browser.activityInfo=new ActivityInfo();browser.activityInfo.packageName="browser.installed";browser.activityInfo.name="Browser";browser.activityInfo.enabled=true;browser.activityInfo.exported=true;
        shadowOf(recording.getPackageManager()).addResolveInfoForIntent(new Intent(Intent.ACTION_VIEW,Uri.parse("https://example.com/")).addCategory(Intent.CATEGORY_BROWSABLE),List.of(browser));
        NotificationNavigation navigation=new NotificationNavigation();navigation.receive(NotificationNavigation.destination(recording,Map.of("kind","product","shopId","bloomrift","productUrl",URL,"path","/pokemon#shop-bloomrift"),"grant"));assertTrue(navigation.needsPolicy(recording));
        ShopPolicy.save(recording,new JSONObject(POLICY));assertFalse(navigation.needsPolicy(recording));assertTrue(navigation.openProduct(recording));assertEquals(1,recording.opened.size());assertEquals(URL,recording.opened.get(0).getDataString());assertEquals("browser.installed",recording.opened.get(0).getPackage());assertTrue(navigation.openProduct(recording));assertEquals(1,recording.opened.size());
        navigation.receive(NotificationNavigation.destination(recording,Map.of("kind","product","shopId","bloomrift","productUrl","https://evil.example/p"),"forged"));assertTrue(navigation.openProduct(recording));assertEquals(1,recording.opened.size());
    }
}
