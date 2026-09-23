import { describe, expect, it } from "vitest";
import {
  foldSearchText,
  productIlikePattern,
  rankSearchMatch,
  searchTokens,
  tokenMatchesWord,
  type SearchField,
} from "@/lib/catalog-search";

/**
 * ÖLÇÜLDÜ (canlı, uçtan uca test, 23 Eylül 2026):
 *  - "keratin" hiçbir işletme döndürmüyordu; Med Kuaför'de bu ürün var.
 *  - "saç boyatmak istiyorum" 0 sonuç; yapay zekâ kapalıyken cümle olduğu
 *    gibi aranıyordu.
 */
const medKuafor: SearchField[] = [
  { text: "Med Kuaför", weight: 4 },
  { text: "Saç bakımı, kişisel bakım, kuaför", weight: 3 },
  { text: "kisisel-bakim", weight: 3 },
  { text: null, weight: 2 },
  { text: "Silvan", weight: 1 },
];
const nakliyat: SearchField[] = [
  { text: "Şeçkin Nakliyat", weight: 4 },
  { text: "Genel", weight: 3 },
  { text: "Her türlü nakliye yapılır", weight: 2 },
  { text: "Silvan", weight: 1 },
];

describe("searchTokens", () => {
  it("dolgu kelimelerini atar, katlar", () => {
    expect(searchTokens("Saç boyatmak istiyorum")).toEqual(["sac", "boyatmak"]);
    expect(searchTokens("Yakınımda ucuz kahve arıyorum")).toEqual(["ucuz", "kahve"]);
  });
  it("yalnız dolgu kelimesi varsa boş döner", () => {
    expect(searchTokens("bir şey istiyorum lütfen")).toEqual(["sey"]);
    expect(searchTokens("ve ile için")).toEqual([]);
  });
});

describe("tokenMatchesWord (Türkçe ekler)", () => {
  it("aranan kelime metindeki kelimenin başıysa", () => {
    expect(tokenMatchesWord("kahve", "kahveci")).toBe(true);
    expect(tokenMatchesWord("kuafor", foldSearchText("kuaför"))).toBe(true);
  });
  it("ekli yazım kökü bulur", () => {
    expect(tokenMatchesWord(foldSearchText("saçımı"), "sac")).toBe(true);
    expect(tokenMatchesWord(foldSearchText("kuaföre"), "kuafor")).toBe(true);
  });
  it("uzak kelimeleri eşleştirmez", () => {
    expect(tokenMatchesWord("pizza", "pide")).toBe(false);
    expect(tokenMatchesWord("sacmalamak", "sac")).toBe(false);
  });
});

describe("rankSearchMatch", () => {
  it("cümle araması: 'saç boyatmak istiyorum' kuaförü bulur", () => {
    const tokens = searchTokens("saç boyatmak istiyorum");
    expect(rankSearchMatch(tokens, medKuafor).matched).toBe(1);
    expect(rankSearchMatch(tokens, nakliyat).matched).toBe(0);
  });

  it("ürün araması: 'keratin' ürünü olan işletmeyi bulur ve ürünü söyler", () => {
    const match = rankSearchMatch(searchTokens("keratin"), medKuafor, [
      "Keratin",
      "Ombre/Sombre&Işıltı",
    ]);
    expect(match.matched).toBe(1);
    expect(match.products).toEqual(["Keratin"]);
  });

  it("aksansız ürün araması: 'sut' → 'Süt'", () => {
    const match = rankSearchMatch(searchTokens("sut"), nakliyat, ["Günlük Süt 1 L"]);
    expect(match.products).toEqual(["Günlük Süt 1 L"]);
  });

  it("çok kelimede, daha çok kelimesi tutan öne geçer", () => {
    const tokens = searchTokens("med kuafor");
    const a = rankSearchMatch(tokens, medKuafor);
    const b = rankSearchMatch(tokens, nakliyat);
    expect(a.matched).toBe(2);
    expect(b.matched).toBe(0);
  });

  it("işletme adıyla bulunduysa ürün satırı gösterilmez", () => {
    const kahveDiyari: SearchField[] = [{ text: "Kahve diyarı", weight: 4 }];
    const match = rankSearchMatch(searchTokens("kahve"), kahveDiyari, ["Türk Kahvesi 100 Gr"]);
    expect(match.matched).toBe(1);
    expect(match.products).toEqual([]);
  });

  it("tam kelime eşleşen ürün önce gelir", () => {
    const match = rankSearchMatch(searchTokens("hindi"), nakliyat, [
      "Hindistan Cevizli Dome Pasta",
      "Hindi Jambonlu Bagel Sandviç",
    ]);
    expect(match.products).toEqual([
      "Hindi Jambonlu Bagel Sandviç",
      "Hindistan Cevizli Dome Pasta",
    ]);
  });

  it("ilgisiz arama eşleşmez", () => {
    expect(rankSearchMatch(searchTokens("pizza"), medKuafor, ["Keratin"]).matched).toBe(0);
  });
});

describe("productIlikePattern", () => {
  it("Türkçe karşılığı olan harfler joker olur, ilk 4 harf", () => {
    expect(productIlikePattern("sut")).toBe('"%__t%"');
    expect(productIlikePattern("keratin")).toBe('"%kera%"');
  });
  it("PostgREST'i bozacak karakter üretmez", () => {
    for (const token of searchTokens('a,b(c) %_ "x" süt')) {
      expect(productIlikePattern(token)).toMatch(/^"%[\p{L}\p{N}_]*%"$/u);
    }
  });
});
