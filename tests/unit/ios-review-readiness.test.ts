import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isNativeApp } from "@/lib/native-notify";

const ROOT = join(import.meta.dirname, "../..");

const authRoute = readFileSync(join(ROOT, "src/routes/auth.tsx"), "utf8");
const applyRoute = readFileSync(join(ROOT, "src/routes/isletme-basvuru.tsx"), "utf8");
const infoPlist = readFileSync(join(ROOT, "ios/App/App/Info.plist"), "utf8");
const capConfig = readFileSync(join(ROOT, "capacitor.config.ts"), "utf8");

/**
 * Apple sürümü Guideline 4 kapsamında reddetti: "kullanıcı giriş yapmak veya
 * kayıt olmak için varsayılan web tarayıcısına çıkarılıyor". Native yol
 * yazıldı, ama her iki giriş ekranında da köprü bulunamazsa tarayıcı akışına
 * düşen bir dal duruyordu. O dal iOS'ta çalışırsa reddedilen davranış birebir
 * geri gelir — üstelik sessizce, çünkü köprünün neden bulunamadığını kimse
 * görmez. iOS'ta artık uygulamadan çıkılmıyor; görünür hata veriliyor ve
 * e-posta ile giriş açık kalıyor.
 */
describe("iOS'ta tarayıcıya çıkış yok", () => {
  for (const [name, source] of [
    ["giriş ekranı", authRoute],
    ["işletme başvurusu", applyRoute],
  ] as const) {
    it(`${name}: tarayıcı akışından önce iOS'u durduruyor`, () => {
      expect(source).toContain("isIosNativeApp()");
      // Tarayıcıya düşen her dalın öncesinde koruma olmalı.
      for (const fallback of ["startBrowserGoogle()", "startAppleOAuth()"]) {
        const at = source.indexOf(`await ${fallback}`);
        if (at === -1) continue;
        const before = source.slice(0, at);
        expect(before.lastIndexOf("isIosNativeApp()")).toBeGreaterThan(
          before.lastIndexOf("hasNativeIosAuth"),
        );
      }
    });
  }
});

/**
 * Giriş ekranındaki yardım metinleri tarayıcı üzerine kuruluydu. iOS
 * uygulamasında hem yanlış (hiçbir tarayıcı açılmıyor) hem de zararlı:
 * inceleyene tam da düzelttiğimiz kusuru işaret ediyor.
 */
describe("giriş ekranı metinleri", () => {
  it("iOS uygulamasında tarayıcı yönlendirmesi göstermiyor", () => {
    expect(authRoute).toContain("isIosApp ? null : (");
  });

  it("kullanıcıya Safari tavsiye etmiyor", () => {
    expect(authRoute).not.toContain("Safari ile\n                en iyi sonucu verir");
    expect(authRoute).not.toContain("iPhone veya iPad'de Safari");
  });

  /** "Supabase sağlayıcısı etkinleştirildikten sonra çalışır" geliştirici notu,
   *  kullanıcıya uygulamanın yarım olduğunu söylüyordu (Guideline 2.1). */
  it("geliştirici kurulum notu içermiyor", () => {
    expect(authRoute).not.toContain("Supabase");
  });
});

describe("Info.plist izin metinleri", () => {
  /** İzin metni olmadan ilgili izin istendiğinde uygulama anında çöker. */
  for (const key of [
    "NSCameraUsageDescription",
    "NSLocationWhenInUseUsageDescription",
    "NSMicrophoneUsageDescription",
    "NSPhotoLibraryUsageDescription",
  ]) {
    it(`${key} tanımlı ve boş değil`, () => {
      const match = new RegExp(`<key>${key}</key>\\s*<string>([^<]+)</string>`).exec(infoPlist);
      expect(match).not.toBeNull();
      expect((match?.[1] ?? "").trim().length).toBeGreaterThan(10);
    });
  }

  /** Bu olmadan her yüklemede dışa aktarım uyumluluğu sorusu soruluyor. */
  it("şifreleme beyanı yapılmış", () => {
    expect(infoPlist).toMatch(/<key>ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/);
  });
});

/**
 * Uygulama uzaktaki adresi yüklüyor. Adres yüklenemezse (kopuk bağlantı,
 * incelemedeki kısıtlı ağ) WKWebView boş beyaz ekran gösteriyor ve uygulama
 * bozuk görünüyor — Guideline 2.1'in en sık tetiklendiği durum.
 */
describe("bağlantı kurulamadığında", () => {
  const errorPage = "public/baglanti-hatasi.html";

  it("yerel hata sayfasına düşüyor", () => {
    expect(capConfig).toContain('errorPath: "baglanti-hatasi.html"');
  });

  it("hata sayfası uygulamayla birlikte paketleniyor", () => {
    expect(capConfig).toMatch(/webDir:\s*"public"/);
    expect(existsSync(join(ROOT, errorPage))).toBe(true);
  });

  /** Sayfa ağsız açılacak; dışarıdan hiçbir şey çekmemeli. */
  it("dış kaynağa bağımlı değil", () => {
    const html = readFileSync(join(ROOT, errorPage), "utf8");
    expect(html).toContain("Tekrar dene");
    const remote = html.match(/(src|href)="https?:\/\/[^"]+"/g) ?? [];
    expect(remote).toEqual([]);
  });
});

/**
 * Bildirimler sayfası başlıktaki zil simgesinden bir dokunuş uzakta; inceleyen
 * kişi oraya kesinlikle bakar. Native kabuk kontrolü yalnızca Android
 * köprüsüne baktığı için iOS uygulamasında sayfa "bu TARAYICI anlık
 * bildirimleri desteklemiyor" diyordu. Hem yanlış (uygulama APNs ile bildirim
 * alıyor) hem de native bir uygulamanın içinde kullanıcıya tarayıcıda olduğunu
 * söylüyor -- bir webview sarmalayıcısının vermemesi gereken izlenimin tam
 * kendisi.
 */
describe("bildirim desteği uyarısı", () => {
  const pushButton = readFileSync(
    join(ROOT, "src/components/notifications/PushNotificationButton.tsx"),
    "utf8",
  );

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubShell(shell: Record<string, unknown>) {
    vi.stubGlobal("window", shell);
  }

  it("iOS kabuğunu native sayıyor", () => {
    stubShell({ Capacitor: { isNativePlatform: () => true, getPlatform: () => "ios" } });
    expect(isNativeApp()).toBe(true);
  });

  it("Android sarmalayıcısını native sayıyor", () => {
    stubShell({ SilvanNative: {} });
    expect(isNativeApp()).toBe(true);
  });

  it("düz tarayıcıda native saymıyor", () => {
    stubShell({});
    expect(isNativeApp()).toBe(false);
  });

  /** Tarayıcıda açılan web sitesi Capacitor nesnesini hiç görmez. */
  it("Capacitor olmayan sayfada native saymıyor", () => {
    stubShell({ Capacitor: { isNativePlatform: () => false, getPlatform: () => "web" } });
    expect(isNativeApp()).toBe(false);
  });

  it("uyarı native uygulamada gösterilmiyor", () => {
    const at = pushButton.indexOf("Bu tarayıcı anlık bildirimleri desteklemiyor");
    expect(at).toBeGreaterThan(-1);
    expect(pushButton.slice(0, at)).toContain("if (isNativeApp()) return null;");
  });
});

/**
 * Bildirim token'ı ilk kurulumda geç geliyor: uygulama açılır açılmaz izin
 * soruluyor, ama web sayfası kullanıcı daha "İzin Ver"e basmadan yükleniyor
 * ve token'ı istiyor. O an APNs kaydı olmadığı için Firebase token veremiyor.
 * Token izin verildikten sonra geliyor — isteyen kimse kalmamışsa kayboluyor.
 * Sonuç: ilk kurulumda cihaz hiç bildirim almıyor ve hiçbir yerde hata
 * görünmüyor. İki taraflı çözüldü: native taraf geç geleni saklıyor, web
 * tarafı aralıkları açarak tekrar soruyor.
 */
describe("iOS bildirim token'ı yarışı", () => {
  const plugin = readFileSync(join(ROOT, "ios/App/App/SilvanPushPlugin.swift"), "utf8");
  const appDelegate = readFileSync(join(ROOT, "ios/App/App/AppDelegate.swift"), "utf8");
  const bridge = readFileSync(join(ROOT, "src/hooks/useFcmTokenBridge.tsx"), "utf8");

  it("geç gelen token çöpe atılmıyor", () => {
    // Yorum satırları sebebi anlatırken o ifadeyi anıyor; kodun kendisine bak.
    const code = appDelegate
      .split("\n")
      .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
      .join("\n");
    expect(code).not.toMatch(/^\s*_ = fcmToken\s*$/m);
    expect(code).toContain("SilvanPushPlugin.cacheToken(fcmToken)");
  });

  it("native taraf token'ı saklıyor", () => {
    expect(plugin).toContain("private static var cachedToken: String?");
    expect(plugin).toContain("static func cacheToken");
  });

  it("saklanan token tekrar sorulduğunda veriliyor", () => {
    const at = plugin.indexOf("Messaging.messaging().token");
    expect(at).toBeGreaterThan(-1);
    expect(plugin.slice(0, at)).toContain("if let cached = Self.cachedToken {");
  });

  it("web tarafı tek denemeyle yetinmiyor", () => {
    expect(bridge).toContain("retryDelaysMs");
    const delays = /retryDelaysMs = \[([^\]]+)\]/.exec(bridge)?.[1] ?? "";
    expect(delays.split(",").length).toBeGreaterThanOrEqual(3);
  });

  it("denemeler bileşen kaldırılınca duruyor", () => {
    expect(bridge).toContain("cancelled = true");
    expect(bridge).toContain("clearTimeout(timer)");
  });
});

/**
 * Capacitor iOS'ta window.open bağlantıyı sistemde açıyor ama JS'e her zaman
 * null dönüyor (createWebViewWith → UIApplication.open, sonra nil). "Açılmadı"
 * sanıp location'a da yazmak, aynı adresi ikinci kez açtırıyordu: kullanıcı
 * tek dokunuşta iki kez uygulamadan çıkıyordu.
 */
describe("harici bağlantı iOS'ta bir kez açılıyor", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const MAPS = "https://www.google.com/maps/search/?api=1&query=Silvan";

  function stubWindow(capacitor: unknown) {
    const location = { href: "" };
    const open = vi.fn(() => null);
    vi.stubGlobal("window", { open, location, Capacitor: capacitor });
    return { location, open };
  }

  it("iOS kabuğunda location'a yazmıyor", async () => {
    const { location, open } = stubWindow({
      isNativePlatform: () => true,
      getPlatform: () => "ios",
    });
    const { openExternalUrl } = await import("@/lib/maps");
    expect(openExternalUrl(MAPS)).toBe(true);
    expect(open).toHaveBeenCalledTimes(1);
    expect(location.href).toBe("");
  });

  /** Tarayıcıda window.open'ı açılır pencere engelleyici durdurabilir; orada
   *  yedek dal gerçekten gerekli ve kalmalı. */
  it("tarayıcıda yedek dal korunuyor", async () => {
    const { location } = stubWindow(undefined);
    const { openExternalUrl } = await import("@/lib/maps");
    expect(openExternalUrl(MAPS)).toBe(true);
    expect(location.href).toBe(MAPS);
  });
});

/**
 * Uygulamanın teması cihazın karanlık moduna değil, site ayarına bağlı; ekran
 * her zaman krem. iOS ise durum çubuğu rengini cihazın moduna göre seçiyordu:
 * karanlık moddaki bir telefonda saat ve pil BEYAZ çiziliyor, krem başlığın
 * üstünde okunmuyordu. Aynı sebeple açılış ekranının sistem zemini karanlık
 * modda siyah oluyordu -- uygulama her açılışta siyahtan kreme atlıyordu.
 */
describe("açılış ve durum çubuğu", () => {
  const storyboard = readFileSync(
    join(ROOT, "ios/App/App/Base.lproj/LaunchScreen.storyboard"),
    "utf8",
  );

  it("arayüz stili sabitlenmiş", () => {
    expect(infoPlist).toMatch(/<key>UIUserInterfaceStyle<\/key>\s*<string>Light<\/string>/);
  });

  it("durum çubuğu koyu içerik istiyor", () => {
    expect(infoPlist).toMatch(
      /<key>UIStatusBarStyle<\/key>\s*<string>UIStatusBarStyleDarkContent<\/string>/,
    );
  });

  it("açılış ekranı sistem rengine bırakılmamış", () => {
    expect(storyboard).not.toContain("systemBackgroundColor");
  });

  /** Açılış görseli Capacitor'ın varsayılan beyazıydı; marka rengine çevrildi. */
  it("açılış görseli marka renginde", async () => {
    const { readFileSync: read } = await import("node:fs");
    const png = read(
      join(ROOT, "ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png"),
    );
    const zlib = await import("node:zlib");
    let idat = Buffer.alloc(0);
    let at = 8;
    while (at < png.length) {
      const length = png.readUInt32BE(at);
      if (png.subarray(at + 4, at + 8).toString() === "IDAT") {
        idat = Buffer.concat([idat, png.subarray(at + 8, at + 8 + length)]);
      }
      at += 12 + length;
    }
    const raw = zlib.inflateSync(idat);
    // İlk bayt satır filtresi; ardından ilk pikselin RGB'si geliyor.
    expect([raw[1], raw[2], raw[3]]).toEqual([244, 237, 218]);
  });

  it("aşırı kaydırmada beyaz yerine marka rengi görünüyor", () => {
    expect(capConfig).toContain('backgroundColor: "#F4EDDA"');
  });
});
