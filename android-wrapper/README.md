# SİLVAN CEBİMDE Android wrapper

This folder is the production Android client. It is a native WebView wrapper (not Capacitor) so the TanStack Start server functions, Supabase session, auth, and orders keep running on https://uygulamamcebimde.online/. Bundling a local `www` folder would show a blank screen because those server routes are not in the APK.

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

Debug (unsigned, sideload) APK:

```bash
export ANDROID_HOME="$HOME/android-sdk"
printf 'sdk.dir=%s\n' "$ANDROID_HOME" > local.properties
./gradlew :app:assembleDebug
```

## WebView session and OAuth

- The wrapper loads only `https://uygulamamcebimde.online/`.
- Cleartext HTTP is disabled in the manifest and in `network_security_config.xml`.
- JavaScript and DOM storage are required for the SPA / Supabase `localStorage` session.
- Third-party cookies are **on** because Google account selection and OAuth use Chrome Custom Tabs. The Custom Tab cookie jar is not the WebView cookie jar; the app returns via `https://uygulamamcebimde.online/auth` or `silvancebimde://oauth`.
- Do not disable third-party cookies or JavaScript without repeating the physical-device OAuth and OTP flows.
