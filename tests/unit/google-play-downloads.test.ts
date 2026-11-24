import { describe, expect, it } from "vitest";
import {
  decodeInstallCsv,
  parseInstallCsv,
  pickOverviewInstallFile,
} from "@/lib/google-play-downloads.server";

describe("pickOverviewInstallFile", () => {
  it("boyutlu dosyaları atlayıp genel dosyayı seçer", () => {
    const files = [
      "stats/installs/installs_online.uygulamamcebimde.app_202611_country.csv",
      "stats/installs/installs_online.uygulamamcebimde.app_202611_overview.csv",
      "stats/installs/installs_online.uygulamamcebimde.app_202611_device.csv",
    ];
    expect(pickOverviewInstallFile(files)).toBe(
      "stats/installs/installs_online.uygulamamcebimde.app_202611_overview.csv",
    );
  });

  it('"overview" yoksa boyut eki taşımayan dosyaya düşer', () => {
    const files = [
      "stats/installs/installs_online.uygulamamcebimde.app_202611_country.csv",
      "stats/installs/installs_online.uygulamamcebimde.app_202611.csv",
    ];
    expect(pickOverviewInstallFile(files)).toBe(
      "stats/installs/installs_online.uygulamamcebimde.app_202611.csv",
    );
  });

  it("hiçbir genel dosya yoksa null döner", () => {
    const files = ["stats/installs/installs_x_202611_country.csv"];
    expect(pickOverviewInstallFile(files)).toBeNull();
  });
});

describe("decodeInstallCsv", () => {
  it("UTF-16LE BOM'lu metni doğru çözer", () => {
    const text = "Date,Total User Installs\n2026-11-20,42\n";
    const utf16 = Buffer.from(text, "utf16le");
    const withBom = Buffer.concat([Buffer.from([0xff, 0xfe]), utf16]);
    expect(
      decodeInstallCsv(
        withBom.buffer.slice(withBom.byteOffset, withBom.byteOffset + withBom.byteLength),
      ),
    ).toBe(text);
  });

  it("BOM yoksa UTF-8 olarak okur", () => {
    const text = "Date,Total User Installs\n2026-11-20,42\n";
    const bytes = new TextEncoder().encode(text);
    expect(decodeInstallCsv(bytes.buffer)).toBe(text);
  });
});

describe("parseInstallCsv", () => {
  it("son satırdaki kümülatif kurulum sayısını okur", () => {
    const csv = [
      "Date,Package Name,Daily Device Installs,Total User Installs",
      "2026-11-18,online.uygulamamcebimde.app,2,40",
      "2026-11-19,online.uygulamamcebimde.app,1,41",
      "2026-11-20,online.uygulamamcebimde.app,3,44",
    ].join("\n");
    const result = parseInstallCsv(csv);
    expect(result.totalInstalls).toBe(44);
    expect(result.periodInstalls).toBe(6);
    expect(result.lastDate).toBe("2026-11-20");
    expect(result.columns).toEqual([
      "Date",
      "Package Name",
      "Daily Device Installs",
      "Total User Installs",
    ]);
  });

  it("beklenen sütunlar yoksa null döner, çökmez", () => {
    const csv = "Something,Else\n1,2";
    const result = parseInstallCsv(csv);
    expect(result.totalInstalls).toBeNull();
    expect(result.periodInstalls).toBeNull();
  });

  it("boş metinde çökmez", () => {
    const result = parseInstallCsv("");
    expect(result).toEqual({
      totalInstalls: null,
      periodInstalls: null,
      lastDate: null,
      columns: [],
    });
  });
});
