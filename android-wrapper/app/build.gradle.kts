import java.util.Properties

plugins {
    id("com.android.application")
}

val googleServicesFile = file("google-services.json")
if (googleServicesFile.exists()) {
    apply(plugin = "com.google.gms.google-services")
}

val signingProps = Properties().apply {
    val signingFile = rootProject.file("signing.properties")
    if (signingFile.exists()) {
        signingFile.inputStream().use { stream -> load(stream) }
    }
}

fun signingValue(propertyName: String, envName: String): String? {
    val fromGradle = providers.gradleProperty(propertyName).orNull
    if (!fromGradle.isNullOrBlank()) return fromGradle
    val fromFile = signingProps.getProperty(propertyName)?.trim()
    if (!fromFile.isNullOrBlank()) return fromFile
    val fromEnv = providers.environmentVariable(envName).orNull
    if (!fromEnv.isNullOrBlank()) return fromEnv
    return null
}

android {
    namespace = "online.uygulamamcebimde.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "online.uygulamamcebimde.app"
        minSdk = 24
        targetSdk = 36
        versionCode = 11
        versionName = "1.9"
    }

    val signingStore = signingValue("android.keystorePath", "ANDROID_KEYSTORE_PATH")
    val signingStorePassword = signingValue("android.keystorePassword", "ANDROID_KEYSTORE_PASSWORD")
    val signingKeyAlias = signingValue("android.keyAlias", "ANDROID_KEY_ALIAS")
    val signingKeyPassword = signingValue("android.keyPassword", "ANDROID_KEY_PASSWORD")
    val hasReleaseSigning = listOf(
        signingStore,
        signingStorePassword,
        signingKeyAlias,
        signingKeyPassword,
    ).all { !it.isNullOrBlank() }

    if (hasReleaseSigning) {
        signingConfigs {
            create("release") {
                storeFile = rootProject.file(signingStore!!)
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
    implementation(platform("com.google.firebase:firebase-bom:33.7.0"))
    implementation("com.google.firebase:firebase-messaging")
}
