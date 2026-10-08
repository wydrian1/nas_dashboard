package hu.wydrian.nas;

import android.app.Activity;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import java.util.LinkedHashSet;
import java.util.Set;

final class BrowserLauncher {
    static boolean open(Activity activity, String url) {
        if (!UrlPolicy.external(url)) return false;
        PackageManager manager = activity.getPackageManager();
        // Resolve an actual HTTPS handler, not a browser launcher or a shop's verified app link.
        Intent probe = new Intent(Intent.ACTION_VIEW, Uri.parse("https://example.com/"))
                .addCategory(Intent.CATEGORY_BROWSABLE);
        Set<String> browsers = new LinkedHashSet<>();
        for (ResolveInfo candidate : manager.queryIntentActivities(probe, PackageManager.MATCH_DEFAULT_ONLY | PackageManager.GET_RESOLVED_FILTER)) addBrowser(browsers, candidate);
        ResolveInfo preferred = manager.resolveActivity(probe, PackageManager.MATCH_DEFAULT_ONLY);
        if (preferred != null && preferred.activityInfo != null && browsers.remove(preferred.activityInfo.packageName)) {
            Set<String> ordered = new LinkedHashSet<>(); ordered.add(preferred.activityInfo.packageName); ordered.addAll(browsers); browsers = ordered;
        }
        for (String browser : browsers) {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url))
                    .addCategory(Intent.CATEGORY_BROWSABLE).setPackage(browser);
            try { activity.startActivity(intent); return true; }
            catch (android.content.ActivityNotFoundException | SecurityException ignored) { /* Try another installed browser. */ }
        }
        return false;
    }

    private static void addBrowser(Set<String> browsers, ResolveInfo info) {
        if (info == null || info.activityInfo == null || info.filter == null) return;
        IntentFilter filter = info.filter;
        // Public SDK filter inspection: full HTTPS handlers, not a domain/path-limited deep link.
        if (filter.hasAction(Intent.ACTION_VIEW) && filter.hasCategory(Intent.CATEGORY_BROWSABLE) && filter.hasDataScheme("https")
                && filter.countDataAuthorities() == 0 && filter.countDataPaths() == 0 && filter.countDataSchemeSpecificParts() == 0
                && info.activityInfo.enabled && info.activityInfo.exported && !"android".equals(info.activityInfo.packageName)) browsers.add(info.activityInfo.packageName);
    }
}
