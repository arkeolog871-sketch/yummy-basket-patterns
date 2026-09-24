import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_TEXT_PREFS,
  TEXT_PREFS_STORAGE_KEY,
  parseTextPrefs,
  textPrefsInlineScript,
} from "@/lib/text-prefs";

type FakeRoot = { attrs: Record<string, string>; vars: Record<string, string> };

function runInlineScript(stored: string | null, prefersMore = false): FakeRoot {
  const root: FakeRoot = { attrs: {}, vars: {} };
  const documentElement = {
    style: { setProperty: (name: string, value: string) => (root.vars[name] = value) },
    setAttribute: (name: string, value: string) => (root.attrs[name] = value),
  };
  const localStorage = {
    getItem: (key: string) => (key === TEXT_PREFS_STORAGE_KEY ? stored : null),
  };
  const window = { matchMedia: () => ({ matches: prefersMore }) };
  new Function("document", "localStorage", "window", textPrefsInlineScript())(
    { documentElement },
    localStorage,
    window,
  );
  return root;
}

describe("yazı ayarı varsayılanı", () => {
  it("herkes için Küçük / Sistem / Yüksek", () => {
    expect(DEFAULT_TEXT_PREFS).toMatchObject({ size: "sm", font: "system", contrast: "high" });
  });

  it("kayıt yoksa ilk boyamadan önce varsayılan uygulanır", () => {
    const root = runInlineScript(null);
    expect(root.attrs).toEqual({
      "data-app-font-size": "sm",
      "data-app-font": "system",
      "data-app-contrast": "high",
    });
    expect(root.vars["--app-font-size"]).toBe("87.5%");
    expect(root.vars["--app-font-family"]).toContain("system-ui");
  });

  it("kaydını yapmış kullanıcının seçimi korunur", () => {
    const saved = { size: "lg", font: "serif", contrast: "default", customColor: "#112233" };
    const root = runInlineScript(JSON.stringify(saved));
    expect(root.attrs["data-app-font-size"]).toBe("lg");
    expect(root.attrs["data-app-font"]).toBe("serif");
    expect(root.attrs["data-app-contrast"]).toBe("default");
    expect(root.vars["--app-font-size"]).toBe("112.5%");
    expect(root.vars["--app-custom-text-color"]).toBe("#112233");
  });

  it("betik ile React tarafı aynı sonucu verir (bozuk kayıt dahil)", () => {
    for (const stored of [
      { size: "xl", font: "comic", contrast: "neon", customColor: "red" },
      { size: "md" },
      {},
    ]) {
      const root = runInlineScript(JSON.stringify(stored));
      const parsed = parseTextPrefs(stored);
      expect(root.attrs["data-app-font-size"]).toBe(parsed.size);
      expect(root.attrs["data-app-font"]).toBe(parsed.font);
      expect(root.attrs["data-app-contrast"]).toBe(parsed.contrast);
      expect(root.vars["--app-custom-text-color"]).toBe(parsed.customColor);
    }
  });

  it("bozuk JSON sayfayı durdurmaz, varsayılana düşer", () => {
    const root = runInlineScript("{bozuk");
    expect(root.attrs["data-app-font-size"]).toBe("sm");
  });

  it("harita künyesi yüksek karşıtlık zorlamasından hariç", () => {
    const css = readFileSync(resolve(__dirname, "../../src/styles.css"), "utf8");
    expect(css).toMatch(/\[data-slot="badge"\], \.gm-style\) \*\)/);
  });
});
