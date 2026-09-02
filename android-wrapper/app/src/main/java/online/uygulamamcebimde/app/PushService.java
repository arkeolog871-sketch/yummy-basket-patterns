package online.uygulamamcebimde.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/**
 * WebView Web Push API'yi desteklemediği için uygulama tamamen kapalıyken
 * (veya arka planda) bildirim göstermenin tek yolu bu servis. Sunucu
 * (push.server.ts) bu cihaza FCM HTTP v1 API üzerinden mesaj gönderdiğinde
 * sistem bu servisi otomatik başlatır.
 *
 * google-services.json eklenmeden bu servis hiç tetiklenmez (token
 * üretilemediği için sunucu bu cihaza asla mesaj gönderemez) — bu yüzden
 * mevcut uygulamayı bozma riski yoktur.
 */
public class PushService extends FirebaseMessagingService {
    private static final String CHANNEL_ID = "orders";

    @Override
    public void onMessageReceived(RemoteMessage message) {
        String title;
        String body;
        RemoteMessage.Notification notification = message.getNotification();
        Map<String, String> data = message.getData();
        if (notification != null) {
            title = notification.getTitle();
            body = notification.getBody();
        } else {
            title = data.get("title");
            body = data.get("body");
        }
        if (title == null || title.trim().isEmpty()) return;

        try {
            ensureChannel();
            NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                    .setSmallIcon(R.drawable.ic_stat_notify)
                    .setContentTitle(title.trim())
                    .setContentText(body == null ? "" : body.trim())
                    .setAutoCancel(true)
                    .setPriority(NotificationCompat.PRIORITY_HIGH);

            // Bildirime dokununca uygulamayı açar (mevcut yerel bildirim davranışıyla
            // aynı hedef sayfa — belirli bir yola yönlendirme yapılmıyor).
            Intent intent = new Intent(this, MainActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent pendingIntent = PendingIntent.getActivity(
                    this,
                    (int) System.currentTimeMillis(),
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            builder.setContentIntent(pendingIntent);

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.notify((int) System.currentTimeMillis(), builder.build());
            }
        } catch (Throwable ignored) {
            // Bildirim gösterimi başarısız olsa bile servis çökmemeli.
        }
    }

    @Override
    public void onNewToken(String token) {
        // Token, WebView her sayfa yüklemesinde MainActivity.syncFcmToken()
        // üzerinden zaten çekilip JS köprüsüyle sunucuya iletiliyor; burada
        // ekstra bir işlem gerekmiyor.
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                getString(R.string.order_channel_name),
                NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription(getString(R.string.order_channel_desc));
        channel.enableVibration(true);
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.createNotificationChannel(channel);
    }
}
