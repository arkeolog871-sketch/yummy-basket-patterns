import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");

describe("Android wrapper static controls", () => {
  const activity = readFileSync(
    join(ROOT, "android-wrapper/app/src/main/java/online/uygulamamcebimde/app/MainActivity.java"),
    "utf8",
  );
  const manifest = readFileSync(
    join(ROOT, "android-wrapper/app/src/main/AndroidManifest.xml"),
    "utf8",
  );
  const gradle = readFileSync(join(ROOT, "android-wrapper/app/build.gradle.kts"), "utf8");

  it("loads the production host over HTTPS", () => {
    expect(activity).toMatch(/https:\/\/uygulamamcebimde\.online/);
    expect(manifest).toMatch(/usesCleartextTraffic="false"/);
  });

  it("declares location and camera permissions as optional features", () => {
    expect(manifest).toMatch(/ACCESS_FINE_LOCATION/);
    expect(manifest).toMatch(/CAMERA/);
    expect(manifest).toMatch(/android.hardware.camera" android:required="false"/);
  });

  it("registers auth deep links", () => {
    expect(manifest).toMatch(/android:host="uygulamamcebimde.online"/);
    expect(manifest).toMatch(/android:pathPrefix="\/auth"/);
    expect(manifest).toMatch(/android:scheme="silvancebimde"/);
    expect(manifest).toMatch(/android:autoVerify="true"/);
  });

  // Cloudflare www/.well-known/assetlinks.json'u apex'e 302'liyor ve Google'ın
  // App Links doğrulayıcısı 302'yi izlemiyor. autoVerify'lı alan adlarından biri
  // doğrulanamazsa çoğu cihazda apex/auth dahil TÜM doğrulama düşer ve Google
  // OAuth dönüşü uygulama yerine tarayıcıda kilitli kalır. www bu yüzden kayıtlı
  // değil; geri eklenirse bu test o gerilemeyi yakalar.
  it("does not register www as an App Links host", () => {
    expect(manifest).not.toMatch(/android:host="www\.uygulamamcebimde\.online"/);
  });

  // Google hesap seçimi, kullanımdan kaldırılan GoogleSignInClient ile hesap
  // seçildikten sonra ID token üretmeden sessizce başarısız oluyordu. Yerine
  // Google'ın güncel yolu (Credential Manager) kondu; eskisine dönülmesi bu
  // testlerle gerileme olarak yakalanır.
  it("signs in with Credential Manager, not the retired GoogleSignInClient", () => {
    expect(activity).toMatch(/androidx\.credentials\.CredentialManager/);
    expect(activity).toMatch(/GetSignInWithGoogleOption/);
    expect(activity).toMatch(/GoogleIdTokenCredential/);
    // Yalnızca kullanımı yasak; sınıfın adı tarihçeyi anlatan yorumda geçebilir.
    expect(activity).not.toMatch(/^\s*import\s+com\.google\.android\.gms\.auth\.api\.signin/m);
    expect(gradle).not.toMatch(/com\.google\.android\.gms:play-services-auth:/);
    expect(gradle).toMatch(/androidx\.credentials:credentials-play-services-auth/);
    expect(gradle).toMatch(/com\.google\.android\.libraries\.identity\.googleid:googleid/);
  });

  // Web yalnızca bu köprüyü görünce native yola giriyor. Eski adın geri gelmesi,
  // kullanımdan kaldırılmış akışı çağıran build'leri yeniden native sanmaya yol açar.
  it("exposes the Credential Manager bridge under its own name", () => {
    expect(activity).toMatch(/public boolean supportsCredentialManagerGoogleSignIn\(\)/);
    expect(activity).toMatch(/public void signInWithGoogleCredentialManager\(\)/);
    expect(activity).not.toMatch(/public boolean supportsNativeGoogleSignIn\(\)/);
  });

  // Hata ile vazgeçme ayrı sinyaller: aksi hâlde gerçek bir hata "vazgeçildi"
  // sanılıp giriş hiçbir geri bildirim vermeden ölüyor.
  it("reports native sign-in failures separately from cancellation", () => {
    expect(activity).toMatch(/GetCredentialCancellationException/);
    expect(activity).toMatch(/__onNativeGoogleSignInUnavailable/);
  });

  it("keeps R8 from stripping the credential classes", () => {
    const proguard = readFileSync(join(ROOT, "android-wrapper/app/proguard-rules.pro"), "utf8");
    expect(proguard).toMatch(/-keep class com\.google\.android\.libraries\.identity\.googleid/);
    expect(proguard).toMatch(/-keep class androidx\.credentials/);
  });

  it("disables mixed content and WebView debugging", () => {
    expect(activity).toMatch(/MIXED_CONTENT_NEVER_ALLOW/);
    expect(activity).toMatch(/setWebContentsDebuggingEnabled\(false\)/);
    expect(activity).toMatch(/setAllowFileAccess\(false\)/);
  });

  it("keeps JavaScript on for the SPA and documents third-party cookies for OAuth", () => {
    expect(activity).toMatch(/setJavaScriptEnabled\(true\)/);
    expect(activity).toMatch(/setAcceptThirdPartyCookies\(webView, true\)/);
    expect(activity).toMatch(/SameSite çerezi için Chrome Custom Tabs/);
    expect(manifest).toMatch(/usesCleartextTraffic="false"/);
    expect(manifest).toMatch(/networkSecurityConfig="@xml\/network_security_config"/);
  });

  it("does not trust preview *.lovable.app hosts inside the production WebView", () => {
    expect(activity).toMatch(/isTrustedWebOrigin/);
    expect(activity).not.toMatch(/host\.endsWith\("\.lovable\.app"\)/);
  });

  it("rejects untrusted intent:// browser_fallback_url hosts", () => {
    expect(activity).toMatch(/isAllowedIntentFallback/);
    expect(activity).toMatch(/isAllowedIntentFallback\(fallbackUrl\)/);
  });

  it("does not embed signing passwords in Gradle", () => {
    expect(gradle).not.toMatch(/storePassword\s*=\s*"/);
    expect(gradle).toMatch(/ANDROID_KEYSTORE/);
  });

  it("loads only the production HTTPS origin, never localhost", () => {
    expect(activity).toMatch(/APP_URL = "https:\/\/uygulamamcebimde\.online\/"/);
    expect(activity).not.toMatch(/localhost/);
    expect(activity).not.toMatch(/127\.0\.0\.1/);
    expect(activity).not.toMatch(/lovable\.app/);
  });

  it("declares notification permission for Android 13+", () => {
    expect(manifest).toMatch(/POST_NOTIFICATIONS/);
  });
});

/**
 * Xiaomi/Huawei/Oppo/Vivo gibi üreticiler Android'in stock pil
 * optimizasyonundan AYRI kendi "otomatik başlatma" ekranını kullanıyor;
 * bildirimleri asıl kesen genelde orası. REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
 * izni Play politikasında kısıtlı olduğundan (yayından kaldırma riski)
 * kullanılmıyor — hem stock pil ayarı hem üretici ekranı için kullanıcı
 * kendi sistem ekranına yönlendiriliyor.
 */
describe("Android üretici otomatik-başlatma ayarı", () => {
  const activity = readFileSync(
    join(ROOT, "android-wrapper/app/src/main/java/online/uygulamamcebimde/app/MainActivity.java"),
    "utf8",
  );
  const manifest = readFileSync(
    join(ROOT, "android-wrapper/app/src/main/AndroidManifest.xml"),
    "utf8",
  );
  const strings = readFileSync(
    join(ROOT, "android-wrapper/app/src/main/res/values/strings.xml"),
    "utf8",
  );

  it("kısıtlı REQUEST_IGNORE_BATTERY_OPTIMIZATIONS iznini istemiyor", () => {
    expect(manifest).not.toMatch(/REQUEST_IGNORE_BATTERY_OPTIMIZATIONS/);
    expect(activity).not.toMatch(/Settings\.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS/);
  });

  it("dört büyük agresif üreticiyi (alt markalar dahil) tanıyor", () => {
    const start = activity.indexOf("private String aggressiveAutoStartManufacturer()");
    expect(start).toBeGreaterThan(-1);
    const body = activity.slice(start, activity.indexOf("\n    }", start));
    for (const brand of [
      "xiaomi",
      "redmi",
      "poco",
      "huawei",
      "honor",
      "oppo",
      "realme",
      "vivo",
      "iqoo",
    ]) {
      expect(body).toContain(`"${brand}"`);
    }
  });

  it("üretici ekranı bulunamazsa stock pil ayarına düşüyor", () => {
    const start = activity.indexOf("private boolean openAutoStartSettings(String oem)");
    expect(start).toBeGreaterThan(-1);
    const body = activity.slice(start, activity.indexOf("\n    }", start));
    expect(body).toContain("ActivityNotFoundException");
    expect(body).toContain("com.miui.securitycenter");
    expect(body).toContain("com.huawei.systemmanager");
    expect(body).toContain("com.coloros.safecenter");
    expect(body).toContain("com.vivo.permissionmanager");

    const callSite = activity.indexOf("openAutoStartSettings(aggressiveOem)");
    expect(callSite).toBeGreaterThan(-1);
    const callBody = activity.slice(callSite - 50, callSite + 150);
    expect(callBody).toContain("openBatteryOptimizationSettings()");
  });

  it("agresif üreticide stock pil muafiyeti varsa bile uyarı atlanmıyor", () => {
    const start = activity.indexOf("private void maybeOfferBatteryExemption()");
    const body = activity.slice(
      start,
      activity.indexOf("aggressiveAutoStartManufacturer()", start) + 400,
    );
    expect(body).toContain("alreadyExempt && aggressiveOem == null");
  });

  it("üretici uyarı metinleri tanımlı", () => {
    expect(strings).toContain('name="autostart_prompt_title"');
    expect(strings).toContain('name="autostart_prompt_body"');
    expect(strings).toContain('name="autostart_prompt_open"');
    expect(activity).toContain("R.string.autostart_prompt_title");
  });
});

/**
 * Sesli asistan: yanıt sunucudan geldikten sonra çalıyor, yani WebView'in
 * gözünde kullanıcı dokunuşu bitmiş olabiliyor. Ayar açık kalırsa ses hiç
 * duyulmuyor ve hiçbir hata görünmüyor — bu yüzden ayrı bir test var.
 */
describe("Android sesli asistan", () => {
  const activity = readFileSync(
    join(ROOT, "android-wrapper/app/src/main/java/online/uygulamamcebimde/app/MainActivity.java"),
    "utf8",
  );
  const manifest = readFileSync(
    join(ROOT, "android-wrapper/app/src/main/AndroidManifest.xml"),
    "utf8",
  );

  it("mikrofon iznini tanıtır", () => {
    expect(manifest).toMatch(/android\.permission\.RECORD_AUDIO/);
  });

  it("WebView'in mikrofon isteğini karşılar", () => {
    expect(activity).toMatch(/RESOURCE_AUDIO_CAPTURE/);
    expect(activity).toMatch(/Manifest\.permission\.RECORD_AUDIO/);
  });

  it("sesli yanıtın çalmasını engellemez", () => {
    expect(activity).toMatch(/setMediaPlaybackRequiresUserGesture\(false\)/);
    expect(activity).not.toMatch(/setMediaPlaybackRequiresUserGesture\(true\)/);
  });
});
