import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");

describe("Android wrapper static controls", () => {
  const activity = readFileSync(
    join(ROOT, "android-wrapper/app/src/main/java/online/uygulamamcebimde/app/MainActivity.java"),
    "utf8",
  );
  const manifest = readFileSync(join(ROOT, "android-wrapper/app/src/main/AndroidManifest.xml"), "utf8");
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
    expect(manifest).toMatch(/android:pathPrefix="\/auth"/);
    expect(manifest).toMatch(/android:scheme="silvancebimde"/);
  });

  it("disables mixed content and WebView debugging", () => {
    expect(activity).toMatch(/MIXED_CONTENT_NEVER_ALLOW/);
    expect(activity).toMatch(/setWebContentsDebuggingEnabled\(false\)/);
    expect(activity).toMatch(/setAllowFileAccess\(false\)/);
  });

  it("does not embed signing passwords in Gradle", () => {
    expect(gradle).not.toMatch(/storePassword\s*=\s*"/);
    expect(gradle).toMatch(/ANDROID_KEYSTORE/);
  });
});
