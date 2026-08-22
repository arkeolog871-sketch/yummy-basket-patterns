# SİLVAN CEBİMDE Android wrapper

This folder builds a signed WebView APK that opens https://uygulamamcebimde.online/.

```bash
export ANDROID_HOME="$HOME/android-sdk"
export JAVA_HOME="$(dirname "$(dirname "$(readlink -f "$(which java)")")")"
./gradlew :app:assembleRelease
cp app/build/outputs/apk/release/app-release.apk ../public/silvan-cebimde.apk
```

iPhone cannot install APK files. The hosted iPhone install link is:

- Page: `/iphone`
- Profile: `/silvan-cebimde-iphone.mobileconfig`

