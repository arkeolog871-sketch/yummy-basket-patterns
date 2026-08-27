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
    expect(manifest).toMatch(/android:host="www.uygulamamcebimde.online"/);
    expect(manifest).toMatch(/android:pathPrefix="\/auth"/);
    expect(manifest).toMatch(/android:scheme="silvancebimde"/);
    expect(manifest).toMatch(/android:autoVerify="true"/);
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
