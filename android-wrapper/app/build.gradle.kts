plugins {
    id("com.android.application")
}

android {
    namespace = "online.uygulamamcebimde.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "online.uygulamamcebimde.app"
        minSdk = 24
        targetSdk = 34
        versionCode = 10
        versionName = "1.9"
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
    implementation("com.google.firebase:firebase-messaging:24.1.1")
}

val googleServicesFile = file("google-services.json")
if (googleServicesFile.exists()) {
    apply(plugin = "com.google.gms.google-services")
}
