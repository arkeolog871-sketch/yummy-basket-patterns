import { describe, expect, it } from "vitest";
import {
  detectColumns,
  detectDelimiter,
  missingRequiredFields,
  normalizeBarcode,
  normalizeUnit,
  parseImportNumber,
  parseProductFile,
} from "@/lib/product-import";

describe("parseImportNumber", () => {
  it("Türkçe ondalık virgülü okur", () => {
    expect(parseImportNumber("12,50")).toBe(12.5);
  });

  /** Fiyat listelerinde binlik ayırıcı sık; form alanlarında yok. */
  it("binlik nokta + ondalık virgül", () => {
    expect(parseImportNumber("1.234,56")).toBe(1234.56);
  });

  it("binlik virgül + ondalık nokta (İngilizce dışa aktarım)", () => {
    expect(parseImportNumber("1,234.56")).toBe(1234.56);
  });

  it("para birimi ve boşluk temizlenir", () => {
    expect(parseImportNumber(" 45,90 ₺ ")).toBe(45.9);
    expect(parseImportNumber("45.90 TL")).toBe(45.9);
  });

  it("sayı olmayanı reddeder", () => {
    expect(parseImportNumber("fiyat yok")).toBeNull();
    expect(parseImportNumber("")).toBeNull();
  });
});

describe("normalizeBarcode", () => {
  it("normal EAN-13", () => {
    expect(normalizeBarcode("8690123456789")).toEqual({
      barcode: "8690123456789",
      corrupt: false,
    });
  });

  /** Excel barkodu metin biçimlendirdiğinde başına kesme işareti koyar. */
  it("baştaki kesme işaretini atar", () => {
    expect(normalizeBarcode("'8690123456789").barcode).toBe("8690123456789");
  });

  /**
   * En sinsi tuzak: Excel 13 haneli barkodu sayı sanıp bilimsel gösterime
   * çevirir ve haneler GERİ GETİRİLEMEZ. Sessizce almak yanlış ürünü yanlış
   * barkodla kaydederdi; reddedip kullanıcıya ne yapacağını söylüyoruz.
   */
  it("bilimsel gösterimi bozuk sayar", () => {
    expect(normalizeBarcode("8.69102E+12")).toEqual({ barcode: null, corrupt: true });
    expect(normalizeBarcode("8,69102E+12").corrupt).toBe(true);
  });

  it("aşırı uzun değeri bozuk sayar", () => {
    expect(normalizeBarcode("123456789012345678").corrupt).toBe(true);
  });

  it("boş değer bozuk değildir", () => {
    expect(normalizeBarcode("   ")).toEqual({ barcode: null, corrupt: false });
  });
});

describe("normalizeUnit", () => {
  it("yaygın yazımları eşler", () => {
    expect(normalizeUnit("ADET")).toBe("adet");
    expect(normalizeUnit("Kg")).toBe("kg");
    expect(normalizeUnit("KİLO")).toBe("kg");
    expect(normalizeUnit("Litre")).toBe("lt");
    expect(normalizeUnit("KT")).toBe("koli");
  });

  it("tanımadığını null döner", () => {
    expect(normalizeUnit("düzine")).toBeNull();
  });
});

describe("detectDelimiter", () => {
  /** Türkçe Excel CSV'yi noktalı virgülle ayırır. */
  it("noktalı virgülü seçer", () => {
    expect(detectDelimiter("Barkod;Ürün Adı;Fiyat")).toBe(";");
  });

  it("virgülü seçer", () => {
    expect(detectDelimiter("barcode,name,price")).toBe(",");
  });

  it("sekmeyi seçer", () => {
    expect(detectDelimiter("Barkod\tAdı\tFiyat")).toBe("\t");
  });
});

describe("detectColumns", () => {
  it("Türkçe başlıkları tanır", () => {
    const mapping = detectColumns(["Barkod", "Stok Adı", "Satış Fiyatı", "Stok Miktarı", "KDV"]);
    expect(mapping.barcode).toBe(0);
    expect(mapping.name).toBe(1);
    expect(mapping.price).toBe(2);
    expect(mapping.stock).toBe(3);
    expect(mapping.vat).toBe(4);
  });

  /** "Stok Kodu" stok sütunu değil, ürün kodudur — karıştırmamalı. */
  it("stok kodunu stok miktarıyla karıştırmaz", () => {
    const mapping = detectColumns(["Stok Kodu", "Barkod", "Fiyat", "Stok"]);
    expect(mapping.externalId).toBe(0);
    expect(mapping.stock).toBe(3);
  });

  it("eşleşmeyen sütunu boş bırakır", () => {
    const mapping = detectColumns(["Barkod", "Fiyat"]);
    expect(mapping.name).toBeUndefined();
    expect(missingRequiredFields(mapping)).toEqual([]);
  });

  it("fiyat yoksa eksik bildirir", () => {
    expect(missingRequiredFields(detectColumns(["Barkod", "Adı"]))).toEqual(["price"]);
  });
});

describe("parseProductFile", () => {
  const file = [
    "Barkod;Stok Adı;Satış Fiyatı;Stok;KDV;Birim;Kategori",
    "8690123456789;Coca Cola 1 Lt;45,90;12;10;adet;İçecek",
    "8690987654321;Sütaş Süt 1 Lt;38,50;5;1;lt;Süt Ürünleri",
  ].join("\r\n");

  it("noktalı virgüllü Türkçe dosyayı okur", () => {
    const result = parseProductFile(file);
    expect(result.rows).toHaveLength(2);
    expect(result.skipped).toHaveLength(0);
    expect(result.rows[0]).toMatchObject({
      barcode: "8690123456789",
      name: "Coca Cola 1 Lt",
      price: 45.9,
      stock: 12,
      vatRate: 10,
      unit: "adet",
      category: "İçecek",
      line: 2,
    });
    expect(result.rows[1]!.unit).toBe("lt");
  });

  /** Dosya başındaki BOM ilk başlığı eşleşmez yapıyordu. */
  it("BOM'lu dosyada ilk sütunu kaybetmez", () => {
    const result = parseProductFile("\uFEFF" + file);
    expect(result.rows[0]!.barcode).toBe("8690123456789");
  });

  it("tırnaklı alandaki ayırıcıyı bölmez", () => {
    const result = parseProductFile(
      ["Barkod;Adı;Fiyat", '8690123456789;"Kahve; öğütülmüş";129,90'].join("\n"),
    );
    expect(result.rows[0]!.name).toBe("Kahve; öğütülmüş");
    expect(result.rows[0]!.price).toBe(129.9);
  });

  it("fiyatı okunamayan satırı nedeniyle atlar", () => {
    const result = parseProductFile(
      ["Barkod;Adı;Fiyat", "8690123456789;Ürün;", "8690987654321;Ürün 2;19,90"].join("\n"),
    );
    expect(result.rows).toHaveLength(1);
    expect(result.skipped[0]).toMatchObject({ line: 2, reason: "Fiyat okunamadı" });
  });

  it("bilimsel gösterimli barkodu açıklamayla atlar", () => {
    const result = parseProductFile(["Barkod;Adı;Fiyat", "8.69102E+12;Ürün;19,90"].join("\n"));
    expect(result.rows).toHaveLength(0);
    expect(result.skipped[0]!.reason).toMatch(/Metin/);
  });

  /** Aynı barkod iki kez: ikinci satır sessizce ilkini ezmemeli. */
  it("dosya içi tekrarlayan barkodu atlar", () => {
    const result = parseProductFile(
      ["Barkod;Adı;Fiyat", "8690123456789;Ürün;19,90", "8690123456789;Ürün tekrar;24,90"].join(
        "\n",
      ),
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.price).toBe(19.9);
    expect(result.skipped[0]!.reason).toMatch(/tekrar/);
  });

  it("barkodsuz ama stok kodlu satırı kabul eder", () => {
    const result = parseProductFile(
      ["Stok Kodu;Adı;Fiyat", "MRK-001;Açık Peynir;289,90"].join("\n"),
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ barcode: null, externalId: "MRK-001", price: 289.9 });
  });

  it("barkod ve stok kodu boş satırı atlar", () => {
    const result = parseProductFile(["Barkod;Adı;Fiyat", ";Ürün;19,90"].join("\n"));
    expect(result.rows).toHaveLength(0);
    expect(result.skipped[0]!.reason).toMatch(/boş/);
  });

  it("stok ondalıklıysa tam sayıya yuvarlar", () => {
    const result = parseProductFile(
      ["Barkod;Adı;Fiyat;Stok", "8690123456789;Kıyma;449,90;2,4"].join("\n"),
    );
    expect(result.rows[0]!.stock).toBe(2);
  });

  it("boş dosyada çökmez", () => {
    expect(parseProductFile("")).toEqual({ headers: [], mapping: {}, rows: [], skipped: [] });
  });

  it("satır üst sınırına uyar", () => {
    const many = ["Barkod;Fiyat"]
      .concat(Array.from({ length: 50 }, (_, i) => `869000000${String(i).padStart(4, "0")};10,00`))
      .join("\n");
    expect(parseProductFile(many, { maxRows: 10 }).rows).toHaveLength(10);
  });
});
