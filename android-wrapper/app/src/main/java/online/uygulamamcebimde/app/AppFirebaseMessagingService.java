package online.uygulamamcebimde.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

/** Arka plan / kapalı uygulama FCM bildirimleri. */
public class AppFirebaseMessagingService extends FirebaseMessagingService {
    private static final String ORDER_CHANNEL_ID = "orders";

    @Override
    public void onMessageReceived(RemoteMessage message) {
        ensureOrderChannel();
        String title = message.getNotification() != null
                ? message.getNotification().getTitle()
                : valueFromData(message, "title");
        String body = message.getNotification() != null
                ? message.getNotification().getBody()
                : valueFromData(message, "body");
        if (title == null || title.trim().isEmpty()) return;

        Intent launch = new Intent(this, MainActivity.class);
        launch.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        String route = valueFromData(message, "deep_link_route");
        if (route == null || route.isEmpty()) {
            route = valueFromData(message, "route");
        }
        if (route != null && !route.isEmpty()) {
            launch.putExtra("deep_link_route", route);
            launch.putExtra("route", route);
        }

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        int requestCode = route != null ? route.hashCode() : 0;
        PendingIntent pending = PendingIntent.getActivity(this, requestCode, launch, flags);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, ORDER_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_notify)
                .setContentTitle(title.trim())
                .setContentText(body == null ? "" : body.trim())
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(pending);

        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) {
            manager.notify((int) System.currentTimeMillis(), builder.build());
        }
    }

    @Override
    public void onNewToken(String token) {
        MainActivity.deliverFcmTokenToWeb(getApplicationContext(), token);
    }

    private void ensureOrderChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
                ORDER_CHANNEL_ID,
                getString(R.string.order_channel_name),
                NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription(getString(R.string.order_channel_desc));
        channel.enableVibration(true);
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.createNotificationChannel(channel);
    }

    private String valueFromData(RemoteMessage message, String key) {
        if (message.getData() == null) return null;
        return message.getData().get(key);
    }
}
