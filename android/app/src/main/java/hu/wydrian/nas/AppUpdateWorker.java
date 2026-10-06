package hu.wydrian.nas;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import androidx.annotation.NonNull;
import androidx.work.*;
import java.util.concurrent.TimeUnit;

public class AppUpdateWorker extends Worker {
    public AppUpdateWorker(@NonNull Context context, @NonNull WorkerParameters parameters) { super(context, parameters); }
    static void schedule(Context context) {
        WorkManager.getInstance(context).enqueueUniquePeriodicWork("app-update-check", ExistingPeriodicWorkPolicy.KEEP,
                new PeriodicWorkRequest.Builder(AppUpdateWorker.class, 6, TimeUnit.HOURS).setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build());
    }
    @NonNull @Override public Result doWork() {
        Context context = getApplicationContext();
        try {
            if (!AppUpdater.check(context)) return Result.success();
            var release = AppUpdater.ready(context); if (release == null) return Result.success();
            if (!TokenSyncWorker.allowed(context)) return Result.success();
            var settings=context.getSharedPreferences("settings",Context.MODE_PRIVATE);int version=release.getInt("versionCode");if(settings.getInt("updateNotifiedVersion",0)==version)return Result.success();
            NasMessagingService.channel(context);
            Intent intent = new Intent(context, MainActivity.class).putExtra("updateReady", true).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            var pending = PendingIntent.getActivity(context, 1100, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            context.getSystemService(NotificationManager.class).notify(1100, new Notification.Builder(context, NasMessagingService.UPDATES).setSmallIcon(R.drawable.ic_notification)
                    .setContentTitle("Új appverzió letöltve · " + release.getString("versionName")).setContentText("Koppints a biztonságos Android-telepítés indításához.")
                    .setContentIntent(pending).setAutoCancel(true).setVisibility(Notification.VISIBILITY_PRIVATE).build());
            settings.edit().putInt("updateNotifiedVersion",version).apply();
            return Result.success();
        } catch (Exception ignored) { return Result.success(); } // next periodic/foreground check; never install failed verification
    }
}
