# SİLVAN CEBİMDE Android wrapper

This folder builds a signed WebView APK that opens https://uygulamamcebimde.online/.
The signing keystore and passwords are intentionally not stored in this repository.

```bash
export ANDROID_HOME="$HOME/android-sdk"
export JAVA_HOME="$(dirname "$(dirname "$(readlink -f "$(which java)")")")"
export ANDROID_KEYSTORE_PATH="/secure/path/silvan-cebimde-release.keystore"
export ANDROID_KEYSTORE_PASSWORD="read-from-your-secret-manager"
export ANDROID_KEY_ALIAS="your-release-alias"
export ANDROID_KEY_PASSWORD="read-from-your-secret-manager"
./gradlew :app:assembleRelease
cp app/build/outputs/apk/release/app-release.apk ../public/silvan-cebimde.apk
```

`build-apk.sh` refuses to create a release APK unless all four signing
variables are present. Keep the keystore outside the checkout and rotate the
previously exposed signing credentials before publishing a new release.
