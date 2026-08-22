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
        versionCode = 1
        versionName = "1.0"
    }

    signingConfigs {
        create("release") {
            storeFile = file("silvan-cebimde.keystore")
            storePassword = "silvancebimde2026"
            keyAlias = "silvan"
            keyPassword = "silvancebimde2026"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
        }
        debug {
            signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
}
