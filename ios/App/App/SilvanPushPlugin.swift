import Capacitor
import FirebaseMessaging
import Foundation
import UserNotifications
import UIKit
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
 *
 * YAŞANDI: izin uygulama açılır açılmaz (hiçbir açıklama olmadan)
 * isteniyordu ve token yalnızca BELLEKTE tutuluyordu. Bellek her soğuk
 * açılışta sıfırlandığı için, uygulama-içi "İzin ver" ekranı token'ı her
 * seferinde Apple'dan yeniden istemek zorunda kalıyordu — bu da Apple'ın
 * APNs kaydı tamamlanana kadar süren gerçek bir ağ gecikmesi. Kullanıcı
 * ekrana erken basarsa token gelmeden istek düşüyor, ekran "bir daha sorma"
 * diye hiç işaretlemediği için bir dahaki girişte aynı yarış tekrarlanıyordu
 * — "izin verdim ama sürekli soruyor" şikâyetinin tam kaynağı buydu.
 *
 * Artık: (1) izin burada DEĞİL, yalnızca kullanıcı web tarafındaki kendi
 * ekranımızda "İzin ver"e basınca isteniyor (requestNotificationPermission);
 * (2) token bellek yerine UserDefaults'a yazılıyor, yani bir sonraki soğuk
 * açılışta Apple'dan hiç beklemeden anında kullanılabiliyor.
 */
@objc(SilvanPushPlugin)
public class SilvanPushPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SilvanPushPlugin"
    public let jsName = "SilvanPush"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getFcmToken", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestNotificationPermission", returnType: CAPPluginReturnPromise),
    ]

    private static let log = Logger(subsystem: "online.uygulamamcebimde.app", category: "SilvanPush")
    private static let tokenDefaultsKey = "silvan.fcm_token.v1"

    /**
     * Token artık kalıcı depoda (UserDefaults): uygulama tamamen kapanıp
     * açılsa bile bir önceki açılıştan kalan token hemen kullanılabiliyor,
     * Apple'ın APNs kaydını tazelemesini beklemeye gerek kalmıyor.
     */
    private static var cachedToken: String? {
        get { UserDefaults.standard.string(forKey: tokenDefaultsKey) }
        set {
            if let newValue = newValue, !newValue.isEmpty {
                UserDefaults.standard.set(newValue, forKey: tokenDefaultsKey)
            }
        }
    }

    static func cacheToken(_ token: String?) {
        guard let token = token, !token.isEmpty else { return }
        cachedToken = token
        log.info("Token kalıcı depoya yazıldı (\(token.count) karakter)")
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

    /**
     * "Soft-ask": Apple'ın sistem izni YALNIZCA kullanıcı bizim kendi
     * ekranımızda "İzin ver"e bastığında burada istenir — uygulama açılır
     * açılmaz değil. Apple bu izni cihaz başına ÖMÜR BOYU BİR KEZ soruyor;
     * bağlamsız/erken bir açılışta harcanırsa kullanıcı düşünmeden reddedip
     * bir daha asla sorulamaz hâle gelebiliyordu.
     */
    @objc func requestNotificationPermission(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
            if granted {
                DispatchQueue.main.async {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            }
            if let error = error {
                Self.log.info("İzin isteği hata döndürdü: \(error.localizedDescription, privacy: .public)")
            }
            call.resolve(["granted": granted])
        }
    }
}
