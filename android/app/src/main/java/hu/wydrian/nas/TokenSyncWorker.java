package hu.wydrian.nas;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.app.NotificationManager;
import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import androidx.work.WorkManager;
import androidx.work.OneTimeWorkRequest;
import androidx.work.Constraints;
import androidx.work.NetworkType;
import androidx.work.ExistingWorkPolicy;
import org.json.JSONObject;

public class TokenSyncWorker extends Worker {
    public TokenSyncWorker(@NonNull Context context, @NonNull WorkerParameters parameters) { super(context, parameters); }
    static boolean allowed(Context context) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        var channel = manager.getNotificationChannel(NasMessagingService.CHANNEL);
        return (Build.VERSION.SDK_INT < 33 || context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED)
                && manager.areNotificationsEnabled() && (channel == null || channel.getImportance() != NotificationManager.IMPORTANCE_NONE)
                && context.getSharedPreferences("settings", Context.MODE_PRIVATE).getBoolean("pushWanted", true);
    }
    static void schedule(Context context) {
        WorkManager.getInstance(context).enqueueUniqueWork("fcm-token-sync", ExistingWorkPolicy.REPLACE,
                new OneTimeWorkRequest.Builder(TokenSyncWorker.class).setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build());
    }
    @NonNull @Override public Result doWork() {
        SecureStore store = new SecureStore(getApplicationContext()); String secret = store.get("secret"), token = store.get("fcmToken");
        if (secret == null) return Result.success();
        try {
            boolean enabled = allowed(getApplicationContext()) && token != null;
            NasApi.Result response = NasApi.post("/api/mobile/device", new JSONObject().put("action", "register").put("token", token == null ? JSONObject.NULL : token).put("enabled", enabled), secret);
            if (response.status == 401) return Result.failure();
            return response.status == 200 ? Result.success() : getRunAttemptCount() < 4 ? Result.retry() : Result.failure();
        } catch (Exception ignored) { return getRunAttemptCount() < 4 ? Result.retry() : Result.failure(); }
    }
}
