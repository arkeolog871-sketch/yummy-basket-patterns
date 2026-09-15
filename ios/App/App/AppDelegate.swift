import UIKit
import Capacitor
import FirebaseCore
import FirebaseMessaging
import UserNotifications

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate, MessagingDelegate {

    var window: UIWindow?

    /// Herkese açık duyuruların yayınlandığı konu. Sunucudaki
    /// FCM_BROADCAST_TOPIC ve Android tarafındaki adla birebir aynı olmak
    /// zorunda; biri kayarsa yayın o platforma hiç ulaşmaz ve hiçbir hata
    /// görünmez.
    private static let broadcastTopic = "tum-cihazlar"

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        if Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil {
            FirebaseApp.configure()
            Messaging.messaging().delegate = self
        }

        UNUserNotificationCenter.current().delegate = self
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in
            DispatchQueue.main.async {
                application.registerForRemoteNotifications()
            }
        }

        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {}

    func applicationDidEnterBackground(_ application: UIApplication) {}

    func applicationWillEnterForeground(_ application: UIApplication) {}

    func applicationDidBecomeActive(_ application: UIApplication) {}

    func applicationWillTerminate(_ application: UIApplication) {}

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Messaging.messaging().apnsToken = deviceToken
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    /**
     * Token burada geliyor ve eskiden çöpe atılıyordu (`_ = fcmToken`), yani
     * sunucu iOS uygulamasına hiç bildirim gönderemiyordu. Artık eklentinin
     * önbelleğine yazılıyor; web katmanı sorduğunda oradan alıyor.
     *
     * Bu yol özellikle ilk kurulumda kritik: web sayfası token'ı kullanıcı
     * izin vermeden önce istiyor ve o an Firebase token veremiyor. Token izin
     * verildikten sonra buraya düşüyor.
     */
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        SilvanPushPlugin.cacheToken(fcmToken)

        // Duyuru yayınına abonelik burada yapılıyor: token gelmeden önce
        // abone olmak çalışmıyor, çünkü Firebase henüz hazır değil. Token
        // kaydından bağımsız ve kasıtlı olarak giriş şartı taşımıyor --
        // uygulamayı kurup giriş yapmamış bir telefon da duyuruları alsın.
        guard fcmToken != nil else { return }
        Messaging.messaging().subscribe(toTopic: Self.broadcastTopic) { error in
            if let error = error {
                print("[SilvanPush] konu aboneliği başarısız: \(error.localizedDescription)")
            }
        }
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .sound, .badge])
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        completionHandler()
    }
}
