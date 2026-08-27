package online.uygulamamcebimde.app;

import androidx.annotation.NonNull;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class SilvanFcmService extends FirebaseMessagingService {
    @Override
    public void onNewToken(@NonNull String token) {
        SilvanFcm.saveToken(getApplicationContext(), token);
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        // Ön plan: mevcut SilvanNative bildirimi kullanılır. Arka plan/kapalı:
        // FCM notification payload sistem tepsisinde gösterilir.
        if (SilvanFcm.isForeground()) return;
        if (message.getNotification() != null) return;
    }
}
