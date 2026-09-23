import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hexToOklch } from "@/lib/color-math";
import {
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
    expect(hook).toContain("themeCssVariables(seedFromHex(settings.primary_color)");
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
      "applyTypographyCss(settings.typography, document.documentElement, surfaces)",
    );
    const panel = readFileSync("src/components/founder/TypographyPanel.tsx", "utf8");
    expect(panel).toContain("applyTypographyCss(values, document.documentElement, surfaces)");
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
