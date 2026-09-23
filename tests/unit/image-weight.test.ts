import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MAX_DIMENSION, MEDIA_MAX_DIMENSION } from "@/lib/image-resize";

/**
 * ÖLÇÜLDÜ (canlı, uçtan uca test, 23 Eylül 2026): ana sayfa ilk açılışta
 * 7,3 MB indiriyordu, 6,4 MB'ı görsel. Med Kuaför logosu 1600×1600 / 1,4 MB
 * iken 40×40 gösteriliyordu; reklamlar 1600×900 iken 293×165; eski banner
 * (2 MB PNG) reklamlar yüklenirken her seferinde indiriliyordu.
 */
const read = (path: string) => readFileSync(path, "utf8");

describe("görsel boyut sınırları kullanım yerine göre", () => {
  it("logo küçük, galeri en büyük", () => {
    expect(MEDIA_MAX_DIMENSION.logo).toBeLessThanOrEqual(320);
    expect(MEDIA_MAX_DIMENSION.cover).toBeLessThanOrEqual(1200);
    expect(MEDIA_MAX_DIMENSION.banner).toBeLessThanOrEqual(1200);
    expect(MEDIA_MAX_DIMENSION.gallery).toBe(MAX_DIMENSION);
  });

  it("yüksek kaliteli JPEG boyutu uygun olsa da yeniden kodlanır", () => {
    const resize = read("src/lib/image-resize.ts");
    expect(resize).toContain("bytesPerPixel <= JPEG_REENCODE_BYTES_PER_PIXEL");
  });
});

describe("her yükleme yolu küçültür", () => {
  it("işletme paneli: logo, kapak, galeri, ürün", () => {
    expect(read("src/components/vendor/MediaPanel.tsx")).toContain(
      "readImageFile(input.file, input.kind)",
    );
    expect(read("src/components/vendor/MediaPanel.tsx")).toContain(
      'readImageFile(file, "gallery")',
    );
    expect(read("src/components/vendor/ProductPanel.tsx")).toContain(
      'readImageFile(file, "product")',
    );
  });

  it("kurucu paneli: kapak, ürün, reklam, marka", () => {
    const founder = read("src/routes/kurucu.tsx");
    expect(founder).toContain('readUploadImageFile(file, "cover")');
    expect(founder).toContain('readUploadImageFile(file, "product")');
    expect(read("src/components/founder/AdsPanel.tsx")).toContain(
      'shrinkFileForUse(picked, "banner")',
    );
    expect(read("src/components/founder/BrandingPanel.tsx")).toContain("shrinkFileForUse(");
  });

  it("mevcut görselleri küçültme aracı dosyanın kullanım yerini bilir", () => {
    expect(read("src/lib/media-maintenance.functions.ts")).toContain('note(row.logo_url, "logo")');
    expect(read("src/components/founder/MediaCleanupPanel.tsx")).toContain(
      "shrinkImage(blob, contentType, file.maxDimension)",
    );
  });
});

describe("ana sayfa eski banner'ı gereksiz indirmez", () => {
  it("reklam listesi yüklenirken eski banner'a düşülmez", () => {
    expect(read("src/routes/index.tsx")).toContain(
      "!bannersQuery.isPending && settings.banner_url",
    );
  });
});
