plugins {
    id("com.android.application")
}

// google-services.json Firebase Console'dan indirilip buraya (app/) eklenene
// kadar bu eklenti hiç uygulanmaz — mevcut derleme davranışı tamamen aynı
// kalır. Dosya eklenince FCM (kapalı-uygulama bildirimi) otomatik aktifleşir.
val hasGoogleServicesConfig = file("google-services.json").exists()
if (hasGoogleServicesConfig) {
    apply(plugin = "com.google.gms.google-services")
}

android {
    namespace = "online.uygulamamcebimde.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "online.uygulamamcebimde.app"
        minSdk = 24
        targetSdk = 36
        versionCode = 11
        versionName = "1.9.1"
    }

    val signingStore = providers.gradleProperty("android.keystorePath")
        .orElse(providers.environmentVariable("ANDROID_KEYSTORE_PATH"))
        .orNull
    val signingStorePassword = providers.gradleProperty("android.keystorePassword")
        .orElse(providers.environmentVariable("ANDROID_KEYSTORE_PASSWORD"))
        .orNull
    val signingKeyAlias = providers.gradleProperty("android.keyAlias")
        .orElse(providers.environmentVariable("ANDROID_KEY_ALIAS"))
        .orNull
    val signingKeyPassword = providers.gradleProperty("android.keyPassword")
        .orElse(providers.environmentVariable("ANDROID_KEY_PASSWORD"))
        .orNull
    val hasReleaseSigning = listOf(
        signingStore,
        signingStorePassword,
        signingKeyAlias,
        signingKeyPassword,
    ).all { !it.isNullOrBlank() }

    if (hasReleaseSigning) {
        signingConfigs {
            create("release") {
                storeFile = file(signingStore!!)
                storePassword = signingStorePassword
                keyAlias = signingKeyAlias
                keyPassword = signingKeyPassword
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            if (hasReleaseSigning) signingConfig = signingConfigs.getByName("release")
        }
        debug {
            // Never use the production signing key for debug builds.
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("androidx.core:core:1.13.1")
    implementation("androidx.browser:browser:1.8.0")
    // Her zaman dahil (derleme zamanında google-services.json gerektirmez);
    // yapılandırılmadan kullanılırsa PushService/MainActivity.syncFcmToken
    // sessizce no-op kalır (try/catch), FirebaseMessagingService kaydı da
    // token üretilemediği için hiç tetiklenmez.
    implementation(platform("com.google.firebase:firebase-bom:33.5.1"))
    implementation("com.google.firebase:firebase-messaging")
}
