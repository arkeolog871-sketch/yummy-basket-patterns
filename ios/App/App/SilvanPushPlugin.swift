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

    /**
     * Firebase token'ı verdiğinde AppDelegate onu buraya yazar.
     *
     * Gerekli, çünkü sıralama ilk kurulumda aleyhimize işliyor: uygulama
     * açılır açılmaz bildirim izni soruluyor, ama web sayfası kullanıcı daha
     * "İzin Ver"e basmadan yükleniyor ve token'ı istiyor. O anda APNs kaydı
     * henüz yapılmadığı için Firebase token veremiyor. Kullanıcı izni
     * verdiğinde token geliyor — ama isteyen kimse kalmamış oluyor. Sonuç:
     * ilk kurulumda token hiç kaydedilmiyor ve o cihaz bildirim almıyor.
     * Hiçbir yerde hata çıkmıyor, sadece bildirim gelmiyor.
     *
     * Önbellek, geç gelen token'ı web tarafı tekrar sorduğunda hazır tutuyor.
     */
    private static var cachedToken: String?

    static func cacheToken(_ token: String?) {
        guard let token = token, !token.isEmpty else { return }
        cachedToken = token
        log.info("Token önbelleğe alındı (\(token.count) karakter)")
    }

    @objc func getFcmToken(_ call: CAPPluginCall) {
        guard Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil else {
            Self.log.info("Firebase yapılandırılmamış, token yok")
            call.resolve([:])
            return
        }

        if let cached = Self.cachedToken {
            call.resolve(["token": cached])
            return
        }

        // Token ağdan gelebiliyor; tamamlama bloğu metot döndükten sonra
        // çalıştığı için çağrı canlı tutulmalı.
        call.keepAlive = true
        Messaging.messaging().token { token, error in
            call.keepAlive = false
            if let error = error {
                // İzin ekranı hâlâ açıkken beklenen durum: APNs kaydı yok.
                // Web tarafı yeniden soruyor, o yüzden bu ölümcül değil.
                Self.log.info("Token henüz hazır değil: \(error.localizedDescription, privacy: .public)")
                call.resolve([:])
                return
            }
            guard let token = token, !token.isEmpty else {
                Self.log.info("Token henüz hazır değil (boş)")
                call.resolve([:])
                return
            }
            Self.cacheToken(token)
            call.resolve(["token": token])
        }
    }
}
