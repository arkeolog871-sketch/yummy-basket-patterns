# Android imzalama incelemesi ve Google Play doğrulaması

Hiçbir dosya, ayar veya veritabanı değiştirilmedi. Aşağıdakiler yalnızca inceleme sonuçlarıdır; sonda tek bir küçük değişiklik önerisi var.

## 1. Bulgular (doğrulanmış)

- Android istemcisi Capacitor değil: `android-wrapper/` altında native WebView wrapper. Capacitor yalnızca iOS için (`capacitor.config.ts`), `android/` klasörü yok.
- Paket adı doğru: `android-wrapper/app/build.gradle.kts` → `applicationId = "online.uygulamamcebimde.app"` (versionCode 9 / versionName 1.8).
- Release imzalama tamamen ortam değişkeni ile yönetiliyor: `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. Bu dördü yoksa Gradle imzasız derler, `android-wrapper/build-apk.sh` ise doğrudan hata verip durur.
- Bu ortamda o dört değişkenin hiçbiri tanımlı değil; çalışma alanında hiçbir `.keystore`/`.jks`/`.p12` dosyası yok. Java/keytool/apksigner da kurulu değil, yani burada imzalı APK üretilemez.
- Geçmişte repoda bir anahtar deposu vardı: `android-wrapper/app/silvan-cebimde.keystore` (git geçmişinde mevcut, PKCS12 formatı, 2760 bayt), sonradan güvenlik sertleştirmesi commit'inde silindi. Parolası hiçbir yerde saklı değil, bu yüzden içindeki sertifikanın parmak izi doğrulanamıyor ve README bu anahtarın "ifşa olmuş, rotasyona tabi" olduğunu söylüyor.
- `public/silvan-cebimde.apk` (v1.x, eski derleme) v2 imza bloğu taşıyor; içindeki sertifika parmak izleri `B7:0E:6A:B5:…` ve `FE:39:EA:11:…`. **Google Play'in verdiği `52:F0:37:72:…` ile eşleşmiyor.**
- `public/.well-known/assetlinks.json` ve `src/lib/android-assetlinks.ts` içindeki `sha256_cert_fingerprints` hâlâ boş dizi.

## 2. Kesin sonuç: `52:F0:37:72:…` anahtarı bu projede yok

Bu parmak izi Google Play'in size gösterdiği **App Signing (uygulama imzalama) sertifikası**dır; özel anahtarı Google Play App Signing kasasında tutulur ve hiçbir zaman indirilemez, dolayısıyla ne bu repoda ne build sürecinde bulunabilir. Repodaki/geçmişteki keystore en fazla **upload key** olabilir ve parolası mevcut olmadığı için onunla da imzalanamaz.

Lovable tarafında Android release imzalama diye bir yönetim yoktur: Lovable web uygulamasını yayınlar (`uygulamamcebimde.online`), APK imzalama tamamen sizin Play Console + yerel keystore düzeninizde kalır. Bu ortamda Android SDK/Java olmadığı için APK derlemesi de yapılamaz.

## 3. Doğrulamayı tamamlamak için yapılması gerekenler (sizin tarafınızda, manuel)

Seçenek A — Play App Signing zaten aktifse (parmak izi bunu gösteriyor):
1. Play Console → App integrity → App signing ekranında **Upload key certificate** parmak izine bakın.
2. Elinizde o upload key varsa onunla imzalayın; yoksa Play Console'dan **upload key sıfırlama** talebi açıp yeni bir keystore üretin:
   `keytool -genkeypair -v -keystore silvan-cebimde-upload.keystore -alias upload -keyalg RSA -keysize 2048 -validity 10000`
3. Keystore'u checkout dışında güvenli bir yerde tutun ve derleyin:
   ```bash
   export ANDROID_HOME="$HOME/android-sdk"
   export ANDROID_KEYSTORE_PATH=/secure/path/silvan-cebimde-upload.keystore
   export ANDROID_KEYSTORE_PASSWORD=...   # secret manager'dan
   export ANDROID_KEY_ALIAS=upload
   export ANDROID_KEY_PASSWORD=...
   cd android-wrapper && ./build-apk.sh
   ```
4. Play Console'a yükleyin; Play kendi imzasıyla (52:F0:…) yeniden imzalar ve geliştirici doğrulaması bu sertifikayla ilerler.

Seçenek B — Play dışı sideload dağıtım: `public/silvan-cebimde.apk` Play imzasını asla taşımaz; bu dosya doğrulama için kullanılamaz, yalnızca kendi keystore'unuzla imzalı sürüm olur.

## 4. Önerdiğim tek değişiklik (onay verirseniz)

App Links doğrulaması (`/auth` deep link'leri) Play üzerinden kurulan uygulamada, Play App Signing parmak iziyle çalışır. Bu yüzden `52:F0:37:72:53:80:CE:26:86:61:AF:3F:D3:70:FD:D9:27:67:D1:D6:FF:EC:8B:9D:14:85:03:92:FF:81:CE:A3` değerini şu iki yere eklemek gerekir:

- `src/lib/android-assetlinks.ts` → `sha256_cert_fingerprints` dizisi
- `public/.well-known/assetlinks.json` → aynı dizi (statik kopya)

`tests/unit/assetlinks.test.ts` bu dosyaların tutarlılığını zaten kontrol ediyor. Ek olarak (sideload sürümü de deep link açsın diye) upload key parmak izini ikinci eleman olarak ekleyebiliriz — dilerseniz onu da yapayım.

Web uygulaması, e-posta altyapısı ve veritabanına dokunulmayacak.
