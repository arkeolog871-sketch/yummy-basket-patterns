import Capacitor
import FirebaseMessaging
import Foundation
import os

/**
 * iOS uygulamasının bildirim kaydını web katmanına açar.
 *
 * Uygulamada bildirim altyapısının tamamı zaten vardı: Firebase kuruluyor,
 * bildirim izni isteniyor, APNs kaydı yapılıyor ve FCM token'ı üretiliyor.
 * Ama AppDelegate token'ı `_ = fcmToken` ile çöpe atıyordu — token hiçbir
 * zaman sunucuya ulaşmadığı için sunucunun iOS uygulamasına bildirim
 * göndermesi mümkün değildi. Yani iOS'ta native bildirim hiç çalışmıyordu ve
 * bu hiçbir yerde hata vermiyordu.
 *
 * Token'ı sunucuya yazmak kullanıcının oturumunu gerektiriyor, o da web
 * katmanında. Bu yüzden native taraf yalnızca token'ı veriyor; kaydı
 * Android'de olduğu gibi aynı web kodu yapıyor (useFcmTokenBridge).
 *
 * Firebase yapılandırılmamışsa (GoogleService-Info.plist yok) boş sonuç
 * döner — çağıran taraf sessizce atlar, hiçbir akış bozulmaz.
 */
@objc(SilvanPushPlugin)
public class SilvanPushPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SilvanPushPlugin"
    public let jsName = "SilvanPush"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getFcmToken", returnType: CAPPluginReturnPromise)
    ]

    private static let log = Logger(subsystem: "online.uygulamamcebimde.app", category: "SilvanPush")

    @objc func getFcmToken(_ call: CAPPluginCall) {
        guard Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil else {
            Self.log.info("Firebase yapılandırılmamış, token yok")
            call.resolve([:])
            return
        }

        // Token ağdan gelebiliyor; tamamlama bloğu metot döndükten sonra
        // çalıştığı için çağrı canlı tutulmalı.
        call.keepAlive = true
        Messaging.messaging().token { token, error in
            call.keepAlive = false
            if let error = error {
                Self.log.error("Token alınamadı: \(error.localizedDescription, privacy: .public)")
                call.resolve([:])
                return
            }
            guard let token = token, !token.isEmpty else {
                Self.log.error("Token boş geldi")
                call.resolve([:])
                return
            }
            Self.log.info("Token alındı (\(token.count) karakter)")
            call.resolve(["token": token])
        }
    }
}
