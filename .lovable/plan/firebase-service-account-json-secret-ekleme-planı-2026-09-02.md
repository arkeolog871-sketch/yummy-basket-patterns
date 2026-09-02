# FIREBASE_SERVICE_ACCOUNT_JSON Secret Ekleme Planı

## Amaç
Yüklenen Firebase servis hesabı JSON dosyasını `FIREBASE_SERVICE_ACCOUNT_JSON` runtime secret'ı olarak güvenli şekilde saklamak; böylece Android native FCM bildirim gönderimi (`src/lib/fcm.server.ts`) çalışmaya devam etsin.

## Adımlar
1. **Girdi doğrula** — Yüklenen dosyanın geçerli bir Firebase servis hesabı JSON'u olduğunu kontrol et (gerekli alanlar: `project_id`, `client_email`, `private_key`).
2. **Secret kaydet** — Dosya içeriğini `FIREBASE_SERVICE_ACCOUNT_JSON` adıyla runtime secret deposuna kaydet. Değer sohbet veya log çıktısında gösterilmez.
3. **Bağlantıyı doğrula** — `src/lib/fcm.server.ts` içindeki `readServiceAccount` fonksiyonunun secret'i okuyabildiğini ve FCM erişim token'ı alabildiğini kontrol et.
4. **Kod değişikliği yok** — Mevcut `public-env.ts`, `fcm.server.ts` ve `usePushNotifications.tsx` dosyaları olduğu gibi kalır; sadece eksik olan secret tamamlanır.

## Sonuç
- Android APK/WebView üzerinden kapalı-uygulama (background) push bildirimleri yeniden gönderilebilir hale gelir.
- Firebase Console'dan indirilen özel anahtar Lovable Cloud secret yönetiminde saklanır; repo'ya veya istemci koduna yazılmaz.
