package hu.wydrian.nas;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import java.util.Map;

final class NotificationNavigation {
    private String product;

    static Intent destination(Context context, Map<String, String> data, String event) {
        // Start our Activity directly, never a service/broadcast notification trampoline.
        Intent intent = new Intent(context, MainActivity.class)
                .setData(Uri.fromParts("wydrian-notification", event, null))
                .putExtra("path", UrlPolicy.notificationPath(data.get("path")))
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if ("product".equals(data.get("kind")) && UrlPolicy.productUrl(data.get("shopId"), data.get("productUrl")) != null) {
            intent.putExtra("kind", "product").putExtra("shopId", data.get("shopId")).putExtra("productUrl", data.get("productUrl"));
        }
        return intent;
    }

    void receive(Intent intent) {
        // Revalidate at the exported Activity boundary; consume extras to prevent replay on recreation.
        product = "product".equals(intent.getStringExtra("kind"))
                ? UrlPolicy.productUrl(intent.getStringExtra("shopId"), intent.getStringExtra("productUrl")) : null;
        intent.removeExtra("kind"); intent.removeExtra("shopId"); intent.removeExtra("productUrl");
    }

    boolean openProduct(Activity activity) {
        String url = product; product = null;
        return url == null || BrowserLauncher.open(activity, url);
    }
}
