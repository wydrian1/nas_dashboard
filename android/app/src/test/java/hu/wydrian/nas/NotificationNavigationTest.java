package hu.wydrian.nas;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ActivityInfo;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;
import static org.robolectric.Shadows.shadowOf;

@RunWith(RobolectricTestRunner.class)
@Config(manifest = Config.NONE, sdk = {26, 35})
public class NotificationNavigationTest {
    private static final String PRODUCT = "https://www.tcgbolt.hu/termek/pokemon/?variant=2#details";
    private RecordingActivity activity;
    public static class RecordingActivity extends Activity {
        final List<Intent> attempted = new ArrayList<>();
        final List<Intent> opened = new ArrayList<>();
        String missing, forbidden;
        @Override public void startActivity(Intent intent) {
            attempted.add(intent);
            if (intent.getPackage().equals(missing)) throw new ActivityNotFoundException();
            if (intent.getPackage().equals(forbidden)) throw new SecurityException();
            opened.add(intent);
        }
    }
    @Before public void setup() { activity = Robolectric.buildActivity(RecordingActivity.class).create().resume().get(); }
    private Intent notification(String event) {
        return NotificationNavigation.destination(activity, Map.of("kind", "product", "shopId", "tcgbolt", "productUrl", PRODUCT, "path", "/pokemon#shop-tcgbolt"), event);
    }
    private ResolveInfo handler(String name, boolean browser) {
        ResolveInfo info = new ResolveInfo(); info.filter = new IntentFilter(Intent.ACTION_VIEW);
        info.filter.addCategory(Intent.CATEGORY_DEFAULT); info.filter.addCategory(Intent.CATEGORY_BROWSABLE); info.filter.addDataScheme("https");
        if (!browser) info.filter.addDataAuthority("example.com", null);
        info.activityInfo = new ActivityInfo(); info.activityInfo.packageName = name; info.activityInfo.name = name + ".Browser";
        info.activityInfo.enabled = true; info.activityInfo.exported = true; return info;
    }
    private void browsers(ResolveInfo... infos) {
        Intent probe = new Intent(Intent.ACTION_VIEW, Uri.parse("https://example.com/")).addCategory(Intent.CATEGORY_BROWSABLE);
        shadowOf(activity.getPackageManager()).addResolveInfoForIntent(probe, Arrays.asList(infos));
    }
    private void assertProduct(Intent intent, String browser) {
        assertEquals(Intent.ACTION_VIEW, intent.getAction()); assertEquals(PRODUCT, intent.getDataString());
        assertTrue(intent.hasCategory(Intent.CATEGORY_BROWSABLE)); assertEquals(browser, intent.getPackage()); assertNull(intent.getSelector());
    }
    @Test public void notificationStartsOurActivityWithValidatedFallbackAndProduct() {
        Intent intent = notification("stock-1");
        assertEquals(MainActivity.class.getName(), intent.getComponent().getClassName());
        assertEquals("/pokemon#shop-tcgbolt", intent.getStringExtra("path")); assertEquals(PRODUCT, intent.getStringExtra("productUrl"));
        assertEquals(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP, intent.getFlags());
        assertNull(intent.getSelector()); assertEquals("wydrian-notification", intent.getData().getScheme());
    }
    @Test public void notificationHashCollisionsDoNotReplaceAnotherProductsPendingIntent() {
        assertEquals("Aa".hashCode(), "BB".hashCode());
        PendingIntent first = PendingIntent.getActivity(activity, "Aa".hashCode(), notification("Aa"), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        PendingIntent second = PendingIntent.getActivity(activity, "BB".hashCode(), notification("BB"), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        assertNotEquals(first, second);
        assertEquals(MainActivity.class.getName(), shadowOf(first).getSavedIntent().getComponent().getClassName());
    }
    @Test public void coldNotificationWaitsForActivityAndOpensProductOnce() {
        browsers(handler("browser.default", true)); NotificationNavigation navigation = new NotificationNavigation(); Intent intent = notification("cold");
        navigation.receive(intent); assertTrue(activity.opened.isEmpty()); assertFalse(intent.hasExtra("productUrl")); assertFalse(intent.hasExtra("shopId"));
        assertTrue(navigation.openProduct(activity)); assertEquals(1, activity.opened.size()); assertProduct(activity.opened.get(0), "browser.default");
        assertTrue(navigation.openProduct(activity)); assertEquals(1, activity.opened.size());
        // Recreated Activity cannot recover consumed extras.
        NotificationNavigation recreated = new NotificationNavigation(); recreated.receive(intent); recreated.openProduct(activity); assertEquals(1, activity.opened.size());
    }
    @Test public void secondTapOnWarmActivityReplacesDestinationAndPreservesTheExactUrl() {
        browsers(handler("browser.default", true)); NotificationNavigation navigation = new NotificationNavigation(); navigation.receive(notification("first")); navigation.openProduct(activity);
        Intent second = notification("second").putExtra("productUrl", "https://tcgbolt.hu/termek/second/"); navigation.receive(second); navigation.openProduct(activity);
        assertEquals(2, activity.opened.size()); assertEquals("https://tcgbolt.hu/termek/second/", activity.opened.get(1).getDataString());
    }
    @Test public void resolverOrNoDefaultStillFindsAnActualBrowserNotTheShopApp() {
        browsers(handler("android", false), handler("shop.deep.link", false), handler("browser.installed", true));
        assertTrue(BrowserLauncher.open(activity, PRODUCT)); assertProduct(activity.opened.get(0), "browser.installed");
    }
    @Test public void vanishedDefaultBrowserFallsBackToAnotherInstalledBrowser() {
        browsers(handler("browser.missing", true), handler("browser.other", true)); activity.missing = "browser.missing";
        assertTrue(BrowserLauncher.open(activity, PRODUCT)); assertEquals(2, activity.attempted.size()); assertProduct(activity.opened.get(0), "browser.other");
    }
    @Test public void blockedDefaultBrowserFallsBackWithoutDroppingUrl() {
        browsers(handler("browser.blocked", true), handler("browser.other", true)); activity.forbidden = "browser.blocked";
        assertTrue(BrowserLauncher.open(activity, PRODUCT)); assertEquals(2, activity.attempted.size()); assertProduct(activity.opened.get(0), "browser.other");
    }
    @Test public void noBrowserReportsFailureOnceAndKeepsInternalStockDestination() {
        NotificationNavigation navigation = new NotificationNavigation(); Intent intent = notification("no-browser"); navigation.receive(intent);
        assertFalse(navigation.openProduct(activity)); assertEquals("/pokemon#shop-tcgbolt", intent.getStringExtra("path")); assertTrue(activity.opened.isEmpty());
        assertTrue(navigation.openProduct(activity)); assertTrue(activity.attempted.isEmpty());
    }
    @Test public void disabledOrUnexportedHandlersAreNotOpened() {
        ResolveInfo disabled = handler("browser.disabled", true); disabled.activityInfo.enabled = false;
        ResolveInfo privateHandler = handler("browser.private", true); privateHandler.activityInfo.exported = false;
        browsers(disabled, privateHandler); assertFalse(BrowserLauncher.open(activity, PRODUCT)); assertTrue(activity.attempted.isEmpty());
    }
    @Test public void forgedOrMalformedProductExtrasCannotOpenAnExternalTarget() {
        browsers(handler("browser.default", true));
        for (String url : new String[]{"https://evil.example/p", "https://tcgbolt.hu.evil.example/p", "http://tcgbolt.hu/p", "intent://tcgbolt.hu/p", "https://user:pass@tcgbolt.hu/p", "https://tcgbolt.hu:3000/p", "https://gamerunner.hu/p"}) {
            NotificationNavigation navigation = new NotificationNavigation(); navigation.receive(notification("bad").putExtra("productUrl", url)); assertTrue(navigation.openProduct(activity));
            Intent result = NotificationNavigation.destination(activity, Map.of("kind", "product", "shopId", "tcgbolt", "productUrl", url, "path", "https://evil.example"), "bad");
            assertEquals("/pokemon", result.getStringExtra("path"));
            NotificationNavigation candidate = new NotificationNavigation(); candidate.receive(result); candidate.openProduct(activity);
        }
        NotificationNavigation unknownShop = new NotificationNavigation(); unknownShop.receive(notification("bad-shop").putExtra("shopId", "unknown")); unknownShop.openProduct(activity);
        assertTrue(activity.attempted.isEmpty()); assertFalse(BrowserLauncher.open(activity, "javascript:alert(1)"));
    }
    @Test public void taskReleaseTestAndDigestPushStayInsideTheDashboard() {
        browsers(handler("browser.default", true));
        for (String[] kindPath : new String[][]{{"task", "/notes#task-12"}, {"release", "/"}, {"test", "/pokemon"}, {"digest", "/pokemon"}}) {
            Intent intent = NotificationNavigation.destination(activity, Map.of("kind", kindPath[0], "path", kindPath[1], "shopId", "tcgbolt", "productUrl", PRODUCT), kindPath[0]);
            assertEquals(MainActivity.class.getName(), intent.getComponent().getClassName()); assertEquals(kindPath[1], intent.getStringExtra("path")); assertFalse(intent.hasExtra("productUrl"));
            NotificationNavigation navigation = new NotificationNavigation(); navigation.receive(intent); assertTrue(navigation.openProduct(activity));
        }
        assertTrue(activity.attempted.isEmpty());
    }
}
