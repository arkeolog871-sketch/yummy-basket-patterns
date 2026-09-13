import AuthenticationServices
import Capacitor
import CryptoKit
import Foundation
import GoogleSignIn
import UIKit
import os

/**
 * iOS'ta Google ve Apple girişini uygulama içinde tamamlar.
 *
 * Önceden her iki akış da tam sayfa yönlendirmeyle dış alan adına gidiyordu;
 * Capacitor kendi origin'i dışına çıkışı Safari'ye devrettiği için kullanıcı
 * uygulamadan çıkıyordu. Apple bunu Guideline 4 kapsamında reddetti.
 *
 * Google: GoogleSignIn SDK'sı cihazdaki hesaba bakmaz, kendi içinde
 * ASWebAuthenticationSession kullanır — hesabı olmayan kullanıcı da uygulama
 * içinde giriş yapabilir, tarayıcıya çıkış olmaz.
 *
 * Apple: ASAuthorizationController ile gerçek native sayfa (Face ID), hiç
 * tarayıcı yok. Supabase ham nonce ister, Apple ise SHA-256'sını; ikisi de
 * üretilip web tarafına birlikte döndürülür.
 *
 * Her adım os_log'a yazılır (`log stream --predicate 'subsystem ==
 * "online.uygulamamcebimde.app"'`). Android tarafında kodda tek bir log
 * satırı olmadığı için günlerce tahminle ilerlemiştik; tekrarlamayalım.
 */
@objc(SilvanAuthPlugin)
public class SilvanAuthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SilvanAuthPlugin"
    public let jsName = "SilvanAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signInWithGoogle", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signInWithApple", returnType: CAPPluginReturnPromise)
    ]

    private static let log = Logger(subsystem: "online.uygulamamcebimde.app", category: "SilvanAuth")

    /// Apple akışı gecikmeli bittiği için çağrı ve ham nonce burada tutulur.
    private var appleCall: CAPPluginCall?
    private var appleRawNonce: String?
    /// Controller yerel değişkende kalırsa delegate çağrılmadan serbest
    /// bırakılabiliyor; akış boyunca güçlü referans tutulur.
    private var appleController: ASAuthorizationController?

    // MARK: - Google

    @objc func signInWithGoogle(_ call: CAPPluginCall) {
        let info = Bundle.main.infoDictionary
        guard let clientID = info?["GIDClientID"] as? String, !clientID.isEmpty else {
            Self.log.error("GIDClientID Info.plist'te yok")
            call.reject("Google yapılandırması eksik: GIDClientID")
            return
        }
        // Sunucu istemcisi (Web istemci kimliği) verilince Google, arka uç
        // için de kimlik üretir; Supabase'in kabul ettiği audience budur.
        let serverClientID = info?["GIDServerClientID"] as? String

        DispatchQueue.main.async {
            guard let viewController = self.bridge?.viewController else {
                Self.log.error("Sunum yapacak görünüm bulunamadı")
                call.reject("Giriş ekranı açılamadı")
                return
            }
            Self.log.info("Google akışı başlatılıyor")
            GIDSignIn.sharedInstance.configuration = GIDConfiguration(
                clientID: clientID,
                serverClientID: serverClientID
            )
            GIDSignIn.sharedInstance.signIn(withPresenting: viewController) { result, error in
                if let error = error as NSError? {
                    if error.code == GIDSignInError.canceled.rawValue {
                        Self.log.info("Google: kullanıcı vazgeçti")
                        call.resolve(["cancelled": true])
                        return
                    }
                    Self.log.error("Google hatası: \(error.localizedDescription, privacy: .public)")
                    call.reject(error.localizedDescription)
                    return
                }
                guard let idToken = result?.user.idToken?.tokenString, !idToken.isEmpty else {
                    Self.log.error("Google: ID token boş geldi")
                    call.reject("Google kimlik bilgisi alınamadı")
                    return
                }
                Self.log.info("Google: ID token alındı (\(idToken.count) karakter)")
                call.resolve(["idToken": idToken])
            }
        }
    }

    // MARK: - Apple

    @objc func signInWithApple(_ call: CAPPluginCall) {
        let rawNonce = Self.randomNonce()
        appleRawNonce = rawNonce
        call.keepAlive = true
        appleCall = call

        DispatchQueue.main.async {
            Self.log.info("Apple akışı başlatılıyor")
            let request = ASAuthorizationAppleIDProvider().createRequest()
            request.requestedScopes = [.fullName, .email]
            request.nonce = Self.sha256(rawNonce)
            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            self.appleController = controller
            controller.performRequests()
        }
    }

    private func finishApple(_ body: (CAPPluginCall) -> Void) {
        guard let call = appleCall else { return }
        appleCall = nil
        appleRawNonce = nil
        appleController = nil
        // Çağrı, gecikmeli delegate yanıtı için canlı tutulmuştu; sonuç
        // gönderilmeden önce tek kullanımlık hâline döndürülür.
        call.keepAlive = false
        body(call)
    }

    // MARK: - Nonce

    /// Supabase ham nonce ile doğrular; Apple isteğine SHA-256'sı konur.
    private static func randomNonce(length: Int = 32) -> String {
        let charset = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        var bytes = [UInt8](repeating: 0, count: length)
        if SecRandomCopyBytes(kSecRandomDefault, length, &bytes) != errSecSuccess {
            // Kriptografik kaynak yoksa öngörülebilir bir değere düşmek yerine
            // yine rastgele üret; nonce tek kullanımlık ve kısa ömürlüdür.
            bytes = (0..<length).map { _ in UInt8.random(in: 0...255) }
        }
        return String(bytes.map { charset[Int($0) % charset.count] })
    }

    private static func sha256(_ input: String) -> String {
        SHA256.hash(data: Data(input.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}

// MARK: - Apple delegeleri

extension SilvanAuthPlugin: ASAuthorizationControllerDelegate {
    public func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        let rawNonce = appleRawNonce
        finishApple { call in
            guard
                let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                let tokenData = credential.identityToken,
                let idToken = String(data: tokenData, encoding: .utf8),
                let rawNonce
            else {
                Self.log.error("Apple: kimlik bilgisi çözülemedi")
                call.reject("Apple kimlik bilgisi alınamadı")
                return
            }
            let fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
                .compactMap { $0 }
                .joined(separator: " ")
            Self.log.info("Apple: ID token alındı (\(idToken.count) karakter)")
            call.resolve([
                "idToken": idToken,
                "nonce": rawNonce,
                // Apple adı yalnızca ilk girişte gönderir; web tarafı profili
                // bununla doldurur, sonraki girişlerde boş gelir.
                "fullName": fullName
            ])
        }
    }

    public func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithError error: Error
    ) {
        let code = (error as? ASAuthorizationError)?.code
        finishApple { call in
            if code == .canceled {
                Self.log.info("Apple: kullanıcı vazgeçti")
                call.resolve(["cancelled": true])
                return
            }
            Self.log.error("Apple hatası: \(error.localizedDescription, privacy: .public)")
            call.reject(error.localizedDescription)
        }
    }
}

extension SilvanAuthPlugin: ASAuthorizationControllerPresentationContextProviding {
    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        bridge?.viewController?.view.window ?? ASPresentationAnchor()
    }
}
