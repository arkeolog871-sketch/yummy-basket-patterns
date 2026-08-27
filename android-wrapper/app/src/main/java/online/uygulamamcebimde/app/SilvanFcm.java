package online.uygulamamcebimde.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;

import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;

final class SilvanFcm {
    static final String CHANNEL_ID = "orders";
    private static final String PREFS = "silvan_fcm";
    private static final String KEY_TOKEN = "token";
    private static volatile int startedActivities;

    private SilvanFcm() {}

    static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                context.getString(R.string.order_channel_name),
                NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription(context.getString(R.string.order_channel_desc));
        channel.enableVibration(true);
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager != null) manager.createNotificationChannel(channel);
    }

    static void start(Context context) {
        ensureChannel(context);
        try {
            if (FirebaseApp.getApps(context).isEmpty()) {
                FirebaseApp.initializeApp(context);
            }
            if (FirebaseApp.getApps(context).isEmpty()) return;
            FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
                if (!task.isSuccessful()) return;
                String token = task.getResult();
                if (token == null || token.isEmpty()) return;
                saveToken(context.getApplicationContext(), token);
            });
        } catch (Throwable ignored) {
            // google-services.json yoksa FCM kapalı; WebView uygulaması çalışır.
        }
    }

    static void saveToken(Context context, String token) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY_TOKEN, token)
                .apply();
    }

    static String getToken(Context context) {
        String token = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_TOKEN, "");
        return token == null ? "" : token;
    }

    static void onActivityStarted() {
        startedActivities++;
    }

    static void onActivityStopped() {
        startedActivities = Math.max(0, startedActivities - 1);
    }

    static boolean isForeground() {
        return startedActivities > 0;
    }
}
