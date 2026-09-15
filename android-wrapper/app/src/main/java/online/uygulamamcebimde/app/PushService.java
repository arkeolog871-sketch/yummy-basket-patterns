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
        String safeTitle = title.trim();
        String safeBody = body == null ? "" : body.trim();

        try {
            ensureChannel();
            NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                    .setSmallIcon(R.drawable.ic_stat_notify)
                    .setContentTitle(safeTitle)
                    .setContentText(safeBody)
                    // Uzun duyuru tek satıra kırpılmasın.
                    .setStyle(new NotificationCompat.BigTextStyle().bigText(safeBody))
                    .setAutoCancel(true)
                    // Android 8 öncesinde kanal yok, öncelik buradan gelir;
                    // 8 ve sonrasında kanalın önemi belirleyici.
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    // Rahatsız Etmeyin modunda "öncelikli" sayılmasını sağlar.
                    .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                    .setDefaults(NotificationCompat.DEFAULT_ALL);

            // Teslimat gecikmişse kart, geldiği anı değil gönderildiği anı
            // göstersin. Birikmiş bildirimlerin hepsi aynı dakikayla görünüp
            // "hepsi şimdi geldi" izlenimi vermesin.
            long sentTime = message.getSentTime();
            if (sentTime > 0) builder.setWhen(sentTime).setShowWhen(true);

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

            // Aynı bildirimin iki kez kart açmasını engelleyen kimlik.
            // İki ayrı tekrar kaynağı var: FCM'in "en az bir kez" teslim
            // garantisi (aynı mesaj iki kez gelebilir) ve duyurunun hem yayın
            // konusundan hem cihazın kendi token'ından gelmesi. İkincisinde
            // mesaj kimlikleri farklı olduğu için sunucu duyurunun kendi
            // kimliğini `dedupe_key` olarak taşıyor.
            String dedupeKey = data.get("dedupe_key");
            String messageId = message.getMessageId();
            int notificationId;
            if (dedupeKey != null && !dedupeKey.isEmpty()) {
                notificationId = dedupeKey.hashCode();
            } else if (messageId != null && !messageId.isEmpty()) {
                notificationId = messageId.hashCode();
            } else {
                notificationId = (safeTitle + "\n" + safeBody).hashCode();
            }

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.notify(notificationId, builder.build());
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
