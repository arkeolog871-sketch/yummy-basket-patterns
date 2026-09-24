import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(__dirname, "../..", path), "utf8");
const page = read("src/routes/restoran.$slug.tsx");
const catalog = read("src/lib/catalog.functions.ts");

describe("işletme sayfası hızı", () => {
  it("kapak fotoğrafı öncelikli, galeri düşük öncelikli", () => {
    const cover = page.slice(page.indexOf("mutfağı`}"), page.indexOf("mutfağı`}") + 400);
    expect(cover).toContain('fetchPriority="high"');
    const gallery = page.slice(
      page.indexOf("işletme fotoğrafı`}"),
      page.indexOf("işletme fotoğrafı`}") + 400,
    );
    expect(gallery).toContain('loading="lazy"');
    expect(gallery).toContain('fetchPriority="low"');
  });

  it("yükleyici verinin tamamını taşır, telefon ikinci kez istemez", () => {
    expect(page).toContain("return { detail: data, loadedAt: Date.now() };");
    expect(page).toMatch(/initialData: \(\) =>[\s\S]*loaderData\.detail/);
    expect(page).toContain("initialDataUpdatedAt: () => loaderData?.loadedAt");
  });

  it("stok bilgisi diğer sorgularla aynı anda çekilir", () => {
    const all = catalog.slice(
      catalog.indexOf("await Promise.all(["),
      catalog.indexOf("const menuItems"),
    );
    expect(all).toContain("readStockFlags(restaurant.id)");
    expect(catalog).not.toMatch(/await readStockFlags\(/);
  });
});
