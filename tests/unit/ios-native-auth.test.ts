import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { hasNativeIosAuth } from "@/lib/ios-native-auth";
// @ts-expect-error -- .mjs derleme betiği, tip bildirimi yok
import { appTargetPluginClasses } from "../../scripts/register-ios-app-plugins.mjs";

const ROOT = join(import.meta.dirname, "../..");
const IOS_CLIENT_ID = "690305033747-8f8nb3epkb00i45p7h3fh8hu74ibt415.apps.googleusercontent.com";

type CapacitorStub = {
  getPlatform: () => string;
  isNativePlatform: () => boolean;
  PluginHeaders?: { name: string; methods?: { name: string }[] }[];
};

/**
 * Testler node ortamında koşuyor; köprü tespiti `window.Capacitor`'a baktığı
 * için pencere nesnesi burada taklit ediliyor.
 */
function installCapacitor(stub: CapacitorStub | null) {
  if (stub) {
    vi.stubGlobal("window", { Capacitor: stub });
  } else {
    vi.stubGlobal("window", undefined);
  }
}

const FULL_HEADERS = [
  {
    name: "SilvanAuth",
    methods: [{ name: "signInWithGoogle" }, { name: "signInWithApple" }],
  },
];

describe("hasNativeIosAuth", () => {
  afterEach(() => {
    installCapacitor(null);
    vi.unstubAllGlobals();
  });

  it("is false in a plain browser (no Capacitor bridge)", () => {
    installCapacitor(null);
    expect(hasNativeIosAuth("signInWithGoogle")).toBe(false);
    expect(hasNativeIosAuth("signInWithApple")).toBe(false);
  });

  it("is true on iOS when the plugin declares the method", () => {
    installCapacitor({
      getPlatform: () => "ios",
      isNativePlatform: () => true,
      PluginHeaders: FULL_HEADERS,
    });
    expect(hasNativeIosAuth("signInWithGoogle")).toBe(true);
    expect(hasNativeIosAuth("signInWithApple")).toBe(true);
  });

  /**
   * Mağazadaki eski sürümlerde eklenti yok. Orada native çağrı
   * "Unimplemented" ile ölürdü; bu yüzden karar platforma değil, gerçekten
   * kayıtlı olan metoda bakar.
   */
  it("is false on an older iOS build that ships without the plugin", () => {
    installCapacitor({
      getPlatform: () => "ios",
      isNativePlatform: () => true,
      PluginHeaders: [{ name: "PushNotifications", methods: [{ name: "register" }] }],
    });
    expect(hasNativeIosAuth("signInWithGoogle")).toBe(false);
  });

  it("is false when only one of the two methods is bridged", () => {
    installCapacitor({
      getPlatform: () => "ios",
      isNativePlatform: () => true,
      PluginHeaders: [{ name: "SilvanAuth", methods: [{ name: "signInWithGoogle" }] }],
    });
    expect(hasNativeIosAuth("signInWithGoogle")).toBe(true);
    expect(hasNativeIosAuth("signInWithApple")).toBe(false);
  });

  it("never claims the iOS path on Android, where Credential Manager is used", () => {
    installCapacitor({
      getPlatform: () => "android",
      isNativePlatform: () => true,
      PluginHeaders: FULL_HEADERS,
    });
    expect(hasNativeIosAuth("signInWithGoogle")).toBe(false);
  });
});

describe("iOS Google sign-in configuration", () => {
  const infoPlist = readFileSync(join(ROOT, "ios/App/App/Info.plist"), "utf8");
  const plugin = readFileSync(join(ROOT, "ios/App/App/SilvanAuthPlugin.swift"), "utf8");

  it("ships the iOS OAuth client id and the Supabase web client id", () => {
    expect(infoPlist).toContain("<key>GIDClientID</key>");
    expect(infoPlist).toContain(IOS_CLIENT_ID);
    // Supabase yalnızca Web istemcisini audience olarak kabul ediyor.
    expect(infoPlist).toMatch(
      /<key>GIDServerClientID<\/key>\s*<string>[^<]*\.apps\.googleusercontent\.com<\/string>/,
    );
  });

  /** Şema, iOS istemci kimliğinin ters çevrilmiş hâli olmak zorunda. */
  it("registers the reversed client id as a URL scheme", () => {
    const reversed = `com.googleusercontent.apps.${IOS_CLIENT_ID.replace(".apps.googleusercontent.com", "")}`;
    expect(infoPlist).toContain("<key>CFBundleURLSchemes</key>");
    expect(infoPlist).toContain(reversed);
  });

  it("bridges both providers under the SilvanAuth JS name", () => {
    expect(plugin).toContain('public let jsName = "SilvanAuth"');
    expect(plugin).toContain('CAPPluginMethod(name: "signInWithGoogle"');
    expect(plugin).toContain('CAPPluginMethod(name: "signInWithApple"');
  });

  /**
   * Apple isteğine nonce'un SHA-256'sı, Supabase'e ham hâli gider. Bu ikisi
   * karışırsa doğrulama "invalid nonce" ile reddedilir.
   */
  it("sends the hashed nonce to Apple and returns the raw one to the web layer", () => {
    expect(plugin).toContain("request.nonce = Self.sha256(rawNonce)");
    expect(plugin).toContain('"nonce": rawNonce');
  });
});

/**
 * Capacitor iOS'ta eklenti taraması yok: köprü yalnızca uygulama paketindeki
 * capacitor.config.json'daki packageClassList'i okuyor ve registerPluginType()
 * autoRegisterPlugins açıkken hiçbir şey yapmıyor. `cap sync` o listeyi sadece
 * npm eklenti paketlerinden üretip her seferinde baştan yazdığı için uygulama
 * hedefindeki SilvanAuthPlugin derlenir ama kaydolmaz. Kaydolmadığında hiçbir
 * şey patlamaz — PluginHeaders'a düşmez, hasNativeIosAuth false döner ve giriş
 * sessizce tarayıcıya çıkar. Yani Apple'ın reddettiği davranış geri gelir.
 * Bu yüzden kayıt adımı testle sabitleniyor.
 */
describe("app-target plugin registration", () => {
  const workflows = ["ios-build", "ios-release"].map((name) => ({
    name,
    yaml: readFileSync(join(ROOT, `.github/workflows/${name}.yml`), "utf8"),
  }));

  /** Gerçek Swift kaynağına bakar: sınıf adı betikte sabit yazılı değil. */
  it("finds SilvanAuthPlugin by scanning the app target sources", () => {
    expect(appTargetPluginClasses()).toContain("SilvanAuthPlugin");
  });

  it.each(workflows)("$name registers app-target plugins after cap sync", ({ yaml }) => {
    const sync = yaml.indexOf("cap sync ios");
    const register = yaml.indexOf("scripts/register-ios-app-plugins.mjs");
    expect(sync).toBeGreaterThan(-1);
    expect(register).toBeGreaterThan(sync);
  });

  /** Kayıt düşerse derleme geçmesin; sessizce yanlış uygulama yayınlanmasın. */
  it.each(workflows)("$name fails the build when the plugin is not registered", ({ yaml }) => {
    expect(yaml).toContain('assert "SilvanAuthPlugin" in cfg.get("packageClassList", [])');
  });

  it("keeps the local cap:sync in step with CI", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    expect(pkg.scripts["cap:sync"]).toContain("register-ios-app-plugins.mjs");
  });
});
