import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");
const BUNDLE_ID = "online.uygulamamcebimde.app";

describe("iOS native shell static controls", () => {
  const capConfig = readFileSync(join(ROOT, "capacitor.config.ts"), "utf8");
  const pbxproj = readFileSync(join(ROOT, "ios/App/App.xcodeproj/project.pbxproj"), "utf8");
  const infoPlist = readFileSync(join(ROOT, "ios/App/App/Info.plist"), "utf8");
  const plist = readFileSync(join(ROOT, "ios/App/App/GoogleService-Info.plist"), "utf8");
  const appDelegate = readFileSync(join(ROOT, "ios/App/App/AppDelegate.swift"), "utf8");
  const packageJson = readFileSync(join(ROOT, "package.json"), "utf8");

  it("uses the production bundle id and display name", () => {
    expect(capConfig).toContain(`appId: "${BUNDLE_ID}"`);
    expect(capConfig).toContain('appName: "Uygulamam Cebimde"');
    expect(pbxproj).toContain(`PRODUCT_BUNDLE_IDENTIFIER = ${BUNDLE_ID};`);
    expect(infoPlist).toContain("Uygulamam Cebimde");
  });

  it("points the WebView at production HTTPS, not a local SSR bundle", () => {
    expect(capConfig).toContain('url: "https://uygulamamcebimde.online"');
    expect(capConfig).not.toMatch(/localhost/);
  });

  it("uses the Xcode target scheme App, not the display name", () => {
    expect(capConfig).toMatch(/scheme:\s*"App"/);
    expect(capConfig).not.toContain('scheme: "Uygulamam Cebimde"');
    expect(capConfig).not.toMatch(/iosScheme:\s*"https"/);
  });

  it("embeds the real Firebase iOS app plist, not an Android client", () => {
    expect(plist).toContain(`<string>${BUNDLE_ID}</string>`);
    expect(plist).toContain("<string>silvan-cebimde</string>");
    expect(plist).toContain("<string>1:690305033747:ios:23206a5ad4e954a5fc01e6</string>");
    expect(plist).toContain("<key>IS_GCM_ENABLED</key>");
    expect(plist).not.toContain(":android:");
    expect(pbxproj).toContain("GoogleService-Info.plist in Resources");
  });

  it("configures Firebase Messaging in the app target", () => {
    expect(appDelegate).toContain("FirebaseApp.configure()");
    expect(appDelegate).toContain("Messaging.messaging().apnsToken");
    expect(pbxproj).toContain("productName = FirebaseCore;");
    expect(pbxproj).toContain("productName = FirebaseMessaging;");
    expect(infoPlist).toContain("remote-notification");
  });

  it("does not add a Capacitor Android platform next to android-wrapper", () => {
    expect(existsSync(join(ROOT, "android"))).toBe(false);
    expect(packageJson).not.toContain("@capacitor/android");
    expect(capConfig).toContain("android-wrapper");
  });
});
