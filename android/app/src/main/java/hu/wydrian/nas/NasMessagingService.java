package hu.wydrian.nas;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.Context;
import android.content.SharedPreferences;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

public class NasMessagingService extends FirebaseMessagingService {
    static final String CHANNEL = "pokemon-stock";
    static void channel(Context context) {
        NotificationChannel channel = new NotificationChannel(CHANNEL, "Pokémon készlet", NotificationManager.IMPORTANCE_DEFAULT);
        channel.setDescription("Új termékek és visszakészletezések a saját webshopfigyelőből.");
        channel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
        context.getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }
    @Override public void onNewToken(String token) {
        try { new SecureStore(this).put("fcmToken", token); TokenSyncWorker.schedule(this); } catch (Exception ignored) { /* Retry on next launch; no token logging. */ }
    }
    @Override public void onMessageReceived(RemoteMessage message) {
        if (new SecureStore(this).get("secret") == null || !TokenSyncWorker.allowed(this)) return;
        channel(this); Map<String, String> data = message.getData(); String event = data.get("eventId");
        if (event == null || event.length() > 80) return;
        SharedPreferences preferences = getSharedPreferences("notification-dedup", MODE_PRIVATE);
        synchronized (NasMessagingService.class) {
            ArrayList<String> seen = new ArrayList<>(preferences.getStringSet("events", java.util.Collections.emptySet()));
            if (seen.contains(event)) return;
            seen.add(event); while (seen.size() > 100) seen.remove(0);
            preferences.edit().putStringSet("events", new HashSet<>(seen)).commit();
        }
        Intent intent = new Intent(this, MainActivity.class).putExtra("path", UrlPolicy.notificationPath(data.get("path")))
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pending = PendingIntent.getActivity(this, event.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification notification = new Notification.Builder(this, CHANNEL).setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(limit(data.get("title"), 150)).setContentText(limit(data.get("body"), 300))
                .setStyle(new Notification.BigTextStyle().bigText(limit(data.get("body"), 300)))
                .setContentIntent(pending).setAutoCancel(true).setVisibility(Notification.VISIBILITY_PRIVATE).build();
        getSystemService(NotificationManager.class).notify(event.hashCode(), notification);
    }
    private String limit(String value, int max) { return value == null ? "Wydrian NAS" : value.substring(0, Math.min(max, value.length())); }
}
