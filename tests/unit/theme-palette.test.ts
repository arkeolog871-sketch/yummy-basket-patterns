import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hexToOklch } from "@/lib/color-math";
import { applyTypographyCss } from "@/lib/typography";
import { brandLogoSrc } from "@/lib/brand-logo";
import {
  buildDarkThemeRoles,
  EMBLEM_CRIMSON,
  EMBLEM_SEED,
  ensureReadableHex,
  MIN_TEXT_CONTRAST,
  MIN_UI_CONTRAST,
  seedFromHex,
  seedToHex,
  themeContrastReport,
  themeCssVariables,
  themeHexColumns,
  themeTextSurfaces,
} from "@/lib/theme-palette";
import { contrastRatio, hexToRgb, oklchToHex, rgbToHex } from "@/lib/color-math";
import { DEFAULT_TYPOGRAPHY } from "@/lib/typography";

/**
 * ÖLÇÜLDÜ (canlı, 23 Eylül 2026): 5 serbest renk alanında vurgu, ikincil ve
 * arka plan aynı krem (#f4edda) seçilmişti: ikincil tuş zeminden ayrışmıyordu
 * (1.0:1), vurgu kullanan simgeler görünmüyordu; ana renk #ff4040 beyaz
 * yazı taşıyamıyordu (3.5:1). Tema artık tek tohumdan türetiliyor.
 */
const hueDistance = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

describe("hangi tohum seçilirse seçilsin tema okunaklı", () => {
  const seeds: { hue: number; boldness: number }[] = [];
  for (let hue = 0; hue < 360; hue += 15) {
    for (const boldness of [0.25, 0.6, 1]) seeds.push({ hue, boldness });
  }

  for (const gamut of ["srgb", "p3"] as const) {
    it(`bütün yazı çiftleri ≥ ${MIN_TEXT_CONTRAST}:1, simgeler ≥ ${MIN_UI_CONTRAST}:1 (${gamut})`, () => {
      for (const seed of seeds) {
        const report = themeContrastReport(seed, gamut);
        for (const row of report.text) {
          expect(
            row.ratio,
            `ton ${seed.hue} cesaret ${seed.boldness}: ${row.name}`,
          ).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
        }
        for (const row of report.ui) {
          expect(row.ratio, `ton ${seed.hue}: ${row.name}`).toBeGreaterThanOrEqual(MIN_UI_CONTRAST);
        }
      }
    });
  }

  it("ikincil ve vurgu rengi zeminle ASLA aynı olmaz (canlıdaki kusur)", () => {
    for (const seed of seeds) {
      const hex = themeHexColumns(seed);
      expect(hex.secondary_color).not.toBe(hex.background_color);
      expect(hex.accent_color).not.toBe(hex.background_color);
    }
  });
});

describe("marka: logodaki amblem", () => {
  it("varsayılan tohum amblemin bordosunun tonunda", () => {
    const emblemHue = hexToOklch(EMBLEM_CRIMSON).h;
    expect(hueDistance(EMBLEM_SEED.hue, emblemHue)).toBeLessThan(1);
    expect(
      hueDistance(hexToOklch(themeHexColumns(EMBLEM_SEED).primary_color).h, emblemHue),
    ).toBeLessThan(5);
  });

  it("ana renk beyaz yazıyı rahat taşır (eskisi 3.5:1)", () => {
    const row = themeContrastReport(EMBLEM_SEED).text.find(
      (item) => item.name === "ana tuş yazısı",
    );
    expect(row!.ratio).toBeGreaterThan(7);
  });

  it("zemin logonun kremi: amblem kutu gibi görünmez", () => {
    expect(themeHexColumns(EMBLEM_SEED).background_color).toBe("#f4edda");
  });
});

describe("tohum saklama", () => {
  it("tohum → renk → tohum dönüşümü korunur", () => {
    for (const seed of [EMBLEM_SEED, { hue: 250, boldness: 0.5 }, { hue: 140, boldness: 1 }]) {
      const back = seedFromHex(seedToHex(seed));
      expect(hueDistance(back.hue, seed.hue)).toBeLessThan(1.5);
      expect(Math.abs(back.boldness - seed.boldness)).toBeLessThan(0.03);
    }
  });

  it("bozuk değer amblem tohumuna düşer", () => {
    expect(seedFromHex("mavi")).toEqual(EMBLEM_SEED);
  });

  it("geniş renk (P3) ekranda ana renk daha doygun, parlaklık aynı", () => {
    const srgb = themeCssVariables(EMBLEM_SEED, "srgb")["--primary"]!;
    const p3 = themeCssVariables(EMBLEM_SEED, "p3")["--primary"]!;
    const parse = (value: string) => value.match(/[\d.]+/g)!.map(Number);
    const [ls, cs] = parse(srgb);
    const [lp, cp] = parse(p3);
    expect(lp).toBe(ls);
    expect(cp!).toBeGreaterThan(cs!);
  });
});

describe("serbest renk alanları kapalı", () => {
  it("kurucu panelinde serbest renk seçici yok", () => {
    const panel = readFileSync("src/components/founder/AppearancePanel.tsx", "utf8");
    expect(panel).not.toContain('type="color"');
    expect(panel).not.toContain("COLOR_FIELDS");
    expect(panel).toContain("themeHexColumns(seed)");
  });

  it("site renkleri tohumdan türetiliyor, eski sütunlar doğrudan yazılmıyor", () => {
    const hook = readFileSync("src/hooks/useSiteSettings.tsx", "utf8");
    expect(hook).toContain("const seed = seedFromHex(settings.primary_color);");
    expect(hook).toContain("themeCssVariables(seed, gamut, scheme)");
    expect(hook).not.toContain('setProperty("--accent", settings.accent_color)');
  });

  it("styles.css varsayılanları üreticiyle aynı (açılışta renk sıçraması yok)", () => {
    const css = readFileSync("src/styles.css", "utf8");
    const vars = themeCssVariables(EMBLEM_SEED, "srgb");
    for (const name of [
      "--primary",
      "--accent",
      "--secondary",
      "--background",
      "--muted-foreground",
    ]) {
      expect(css, name).toContain(`  ${name}: ${vars[name]};`);
    }
  });
});

/**
 * YAŞANDI: `p, span, li, small, label` için yazı rengi koşulsuz zorlanıyordu;
 * bordo "Giriş" tuşunun içindeki yazı beyaz yerine koyu kaldı.
 */
describe("yazı rengi ebeveynden miras alınır", () => {
  const css = readFileSync("src/styles.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

  it("span/p rengi yalnız yüksek karşıtlık / özel renk modunda zorlanır", () => {
    const plain = /\n\s*p,\s*span,\s*li,\s*small,\s*label\s*\{([^}]*)\}/.exec(css);
    expect(plain, "temel kural yok").not.toBeNull();
    expect(plain![1]).not.toMatch(/(^|\s)color:/);
    expect(css).toContain('html:is([data-app-contrast="high"], [data-app-contrast="custom"])');
  });

  it("zorlandığında bile tuş, bağlantı ve rozet içinde zorlanmaz", () => {
    expect(css).toContain(':not(:is(button, a, [role="button"], [data-slot="badge"]) *)');
  });

  it("vurgu rengi (açık altın) yazı rengi olarak kullanılmıyor", () => {
    const hits = execSync("grep -rnE 'text-accent([^-a-z]|$)' src --include=*.tsx || true", {
      encoding: "utf8",
    }).trim();
    expect(hits).toBe("");
  });
});

/**
 * ÖLÇÜLDÜ (canlı): yazı ayarlarındaki soluk gri #6b7280 krem zeminde 4.14:1,
 * alt bilgide 3.84:1'di; tema güvencesi yazı ayarlarıyla atlatılıyordu.
 */
describe("yazı ayarlarının renkleri de okunaklı", () => {
  const surfaces = themeTextSurfaces(EMBLEM_SEED);
  const weakest = (color: string) => Math.min(...surfaces.map((bg) => contrastRatio(color, bg)));

  it("canlıdaki soluk gri tüm zeminlerde ≥ 4.5:1'e çekilir", () => {
    expect(weakest("#6b7280")).toBeLessThan(MIN_TEXT_CONTRAST);
    expect(weakest(ensureReadableHex("#6b7280", surfaces))).toBeGreaterThanOrEqual(
      MIN_TEXT_CONTRAST,
    );
  });

  it("zaten okunaklı renk değişmez", () => {
    expect(ensureReadableHex("#1a1a1a", surfaces)).toBe("#1a1a1a");
  });

  it("ton korunur, yalnız parlaklık değişir", () => {
    const before = hexToOklch("#8b7a9b");
    const after = hexToOklch(ensureReadableHex("#8b7a9b", surfaces));
    expect(hueDistance(before.h, after.h)).toBeLessThan(6);
    expect(after.l).toBeLessThan(before.l);
  });

  it("varsayılan yazı ayarlarının bütün metin renkleri okunaklı hâle gelir", () => {
    const t = DEFAULT_TYPOGRAPHY;
    for (const color of [t.primaryText, t.mutedText, t.headingText, t.accent, t.accentHover]) {
      expect(weakest(ensureReadableHex(color, surfaces)), color).toBeGreaterThanOrEqual(
        MIN_TEXT_CONTRAST,
      );
    }
  });

  it("site ve yazı paneli yazı renklerini zeminlerle birlikte uygular", () => {
    const hook = readFileSync("src/hooks/useSiteSettings.tsx", "utf8");
    expect(hook).toContain(
      "applyTypographyCss(settings.typography, document.documentElement, readability)",
    );
    const panel = readFileSync("src/components/founder/TypographyPanel.tsx", "utf8");
    expect(panel).toContain("applyTypographyCss(values, document.documentElement, readability)");
  });
});

/**
 * ÖLÇÜLDÜ (canlı, 23 Eylül 2026, #219 sonrası): 265 yazıdan kalan tek kusur
 * kartlardaki "Ücretsiz teslimat" rozetiydi: beyaz yazı yeşil --success
 * üzerinde 3.38:1. Kırmızı --destructive de krem zeminde 4.07:1 kalıyordu.
 * Durum renkleri hem dolgu (beyaz yazı) hem yazı (krem ve %15 tonu) olarak
 * ≥ 4.5:1 olmalı.
 */
describe("durum renkleri okunaklı", () => {
  const LOGO_CREAM = "#f4edda";
  const css = readFileSync("src/styles.css", "utf8");
  const root = css.slice(css.indexOf(":root {"), css.indexOf(".dark {"));
  const token = (name: string) => {
    const match = root.match(new RegExp(`  ${name}: oklch\\(([\\d.]+) ([\\d.]+) ([\\d.]+)\\);`));
    expect(match, name).not.toBeNull();
    const [l, c, h] = match!.slice(1, 4).map(Number) as [number, number, number];
    return oklchToHex(l, c, h);
  };
  const tint = (color: string, alpha: number) => {
    const fg = hexToRgb(color);
    const bg = hexToRgb(LOGO_CREAM);
    return rgbToHex(fg.map((v, i) => v * alpha + bg[i]! * (1 - alpha)) as typeof fg);
  };

  for (const name of ["--success", "--destructive"]) {
    it(`${name}: beyaz yazı taşır, kremde ve %15 tonunda yazı olur`, () => {
      const color = token(name);
      expect(contrastRatio("#ffffff", color)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
      expect(contrastRatio(color, LOGO_CREAM)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
      expect(contrastRatio(color, tint(color, 0.15))).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    });
  }

  it("açık zemin üstünde dolgu yazı rengi kullanılmaz", () => {
    const panel = readFileSync("src/components/founder/TypographyPanel.tsx", "utf8");
    expect(panel).not.toMatch(/bg-success\/10 text-success-foreground/);
  });
});

/**
 * 2. adım: koyu tema "Gece Çarşısı", aynı tohumdan. Bordo-siyah zemin, krem
 * yazı, altın ana tuş, bordo vurgu. Açık temadaki güvence burada da geçerli.
 */
describe("koyu tema: hangi tohum seçilirse seçilsin okunaklı", () => {
  for (const gamut of ["srgb", "p3"] as const) {
    it(`bütün tonlar ve cesaretler (${gamut})`, () => {
      for (let hue = 0; hue < 360; hue += 15) {
        for (const boldness of [0.25, 0.6, 1]) {
          const report = themeContrastReport({ hue, boldness }, gamut, "dark");
          for (const row of report.text) {
            expect(row.ratio, `${hue}/${boldness} ${row.name}`).toBeGreaterThanOrEqual(
              MIN_TEXT_CONTRAST,
            );
          }
          for (const row of report.ui) {
            expect(row.ratio, `${hue}/${boldness} ${row.name}`).toBeGreaterThanOrEqual(
              MIN_UI_CONTRAST,
            );
          }
        }
      }
    });
  }

  it("zemin koyu, ana renk altın (vurgu tonunda), vurgu bordo", () => {
    const roles = buildDarkThemeRoles(EMBLEM_SEED);
    expect(roles.background.l).toBeLessThan(0.25);
    expect(roles.foreground.l).toBeGreaterThan(0.85);
    expect(hueDistance(roles.primary.h, EMBLEM_SEED.hue + 58)).toBeLessThan(1);
    expect(hueDistance(roles.accent.h, EMBLEM_SEED.hue)).toBeLessThan(1);
  });

  it("styles.css .dark bloğu üreticiyle aynı", () => {
    const css = readFileSync("src/styles.css", "utf8");
    const dark = css.slice(css.indexOf(".dark {"));
    const vars = themeCssVariables(EMBLEM_SEED, "srgb", "dark");
    for (const name of [
      "--background",
      "--foreground",
      "--card",
      "--primary",
      "--primary-foreground",
      "--accent",
      "--secondary",
      "--muted-foreground",
      "--border",
    ]) {
      expect(dark, name).toContain(`  ${name}: ${vars[name]};`);
    }
  });

  it("koyu temada durum renkleri okunaklı", () => {
    const css = readFileSync("src/styles.css", "utf8");
    const dark = css.slice(css.indexOf(".dark {"));
    const token = (name: string) => {
      const match = dark.match(new RegExp(`  ${name}: oklch\\(([\\d.]+) ([\\d.]+) ([\\d.]+)\\);`));
      expect(match, name).not.toBeNull();
      const [l, c, h] = match!.slice(1, 4).map(Number) as [number, number, number];
      return oklchToHex(l, c, h);
    };
    const background = token("--background");
    for (const name of ["--success", "--destructive"]) {
      const color = token(name);
      const bg = hexToRgb(background);
      const tint = rgbToHex(hexToRgb(color).map((v, i) => v * 0.15 + bg[i]! * 0.85) as typeof bg);
      expect(contrastRatio(token(`${name}-foreground`), color), name).toBeGreaterThanOrEqual(
        MIN_TEXT_CONTRAST,
      );
      expect(contrastRatio(color, background), name).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
      expect(contrastRatio(color, tint), name).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    }
  });

  /**
   * YAŞANMASIN: yazı ayarları --foreground'u #1a1a1a yapıyor; koyu zeminde
   * bu siyah üstüne siyah olurdu. Koyu temada renkler temadan gelir.
   */
  it("koyu temada yazı ayarlarının renkleri temadan gelir, --foreground ezilmez", () => {
    const written = new Map<string, string>();
    const target = {
      style: { setProperty: (name: string, value: string) => written.set(name, value) },
    } as unknown as HTMLElement;
    applyTypographyCss(DEFAULT_TYPOGRAPHY, target, "dark");
    expect(written.get("--text-primary")).toBe("var(--foreground)");
    expect(written.get("--text-muted")).toBe("var(--muted-foreground)");
    expect(written.get("--text-heading")).toBe("var(--foreground)");
    expect(written.get("--text-accent")).toBe("var(--primary)");
    expect(written.has("--foreground")).toBe(false);
    expect(written.get("--font-main")).toContain("Plus Jakarta Sans");
  });

  it("Otomatik: cihaz koyuysa koyu; kurucu seçimi kaydedilebilir", () => {
    const hook = readFileSync("src/hooks/useSiteSettings.tsx", "utf8");
    expect(hook).toContain('settings.theme_mode === "system" && prefersDark');
    expect(hook).toContain("(prefers-color-scheme: dark)");
    const server = readFileSync("src/lib/founder.functions.ts", "utf8");
    expect(server).toContain('z.enum(["light", "dark", "system"])');
    const panel = readFileSync("src/components/founder/AppearancePanel.tsx", "utf8");
    expect(panel).toContain('value: "system"');
  });

  /**
   * ÖLÇÜLDÜ (kaynak kod, 23 Eylül 2026): iki uygulama kabuğu da cihazdan
   * bağımsız AÇIK bildiriyor. "Otomatik" bu yüzden uygulamalarda açık kalır
   * ve durum çubuğuyla çelişmez. Kabuklar cihazı izlemeye başlarsa bu test
   * kırılır: o sürümde durum çubuğu renkleri de koyu temaya uydurulmalı.
   */
  it("uygulama kabukları hep açık tema bildiriyor", () => {
    const plist = readFileSync("ios/App/App/Info.plist", "utf8");
    expect(plist).toMatch(/<key>UIUserInterfaceStyle<\/key>\s*<string>Light<\/string>/);
    const themes = readFileSync("android-wrapper/app/src/main/res/values/themes.xml", "utf8");
    expect(themes).toContain('parent="@android:style/Theme.Material.Light.NoActionBar"');
  });
});

describe("amblem", () => {
  it("varsayılan amblem başlıkta zemini saydam sürümüyle gösterilir", () => {
    expect(brandLogoSrc("/logo-mark.png")).toBe("/logo-mark-transparent.png");
    expect(brandLogoSrc("/api/public/brand/logo/x.png")).toBe("/api/public/brand/logo/x.png");
    const png = readFileSync("public/logo-mark-transparent.png");
    // PNG IHDR: renk türü 6 = RGBA (saydamlık kanalı var).
    expect(png[25]).toBe(6);
  });
});

describe("koyu temada fotoğraf üstü yazı", () => {
  /** YAŞANDI (canlı, koyu tema): işletme adı text-background idi, koyu kaldı. */
  it("işletme sayfasında ad ve slogan fotoğraf karartması üstünde beyaz", () => {
    const page = readFileSync("src/routes/restoran.$slug.tsx", "utf8");
    expect(page).not.toMatch(/<h1[^>]*text-background/);
    expect(page).toContain('className="truncate text-3xl text-white sm:text-4xl"');
  });
});
