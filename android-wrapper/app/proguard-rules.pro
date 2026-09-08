# --- WebView JavaScript köprüsü ---
# SilvanNativeBridge metodları (MainActivity.java) WebView tarafından JS'ten
# isimleriyle reflection ile çağrılır (window.SilvanNative.openMaps(...) vb.);
# R8 bunları yeniden adlandırır/kaldırırsa köprü sessizce bozulur.
-keepattributes *Annotation*
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# --- Firebase Cloud Messaging ---
# google-services.json isteğe bağlı (bkz. build.gradle.kts) ama bağımlılık
# her zaman derlemeye dahil. Firebase'in kendi consumer-proguard kuralları
# zaten uygulanır; bu ek kurallar savunma amaçlı.
-keep class com.google.firebase.messaging.** { *; }
-dontwarn com.google.firebase.**
