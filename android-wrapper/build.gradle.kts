plugins {
    id("com.android.application") version "8.6.1" apply false
    // google-services.json eklenene kadar app/build.gradle.kts bu eklentiyi
    // uygulamıyor (bkz. hasGoogleServicesConfig) — burada "apply false" ile
    // sadece sürüm çözümü sağlanıyor, mevcut derlemeyi etkilemez.
    id("com.google.gms.google-services") version "4.4.2" apply false
}
