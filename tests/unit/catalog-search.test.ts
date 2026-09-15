import { describe, expect, it } from "vitest";

import { foldSearchText, ilikePattern, matchesSearchTerms } from "@/lib/catalog-search";

describe("foldSearchText", () => {
  it("Türkçe büyük harfi doğru küçültür", () => {
    expect(foldSearchText("KUAFÖR")).toBe("kuafor");
    expect(foldSearchText("NURŞİN")).toBe("nursin");
    // "I" Türkçede "ı"ya iner, ardından "i"ye katlanır.
    expect(foldSearchText("IRFAN")).toBe("irfan");
    expect(foldSearchText("İrfan")).toBe("irfan");
  });

  it("aksanlı ve aksansız yazımı aynı değere indirir", () => {
    expect(foldSearchText("Kuaför")).toBe(foldSearchText("kuafor"));
    expect(foldSearchText("Şoför")).toBe(foldSearchText("sofor"));
    expect(foldSearchText("Nurşin")).toBe(foldSearchText("nursin"));
    expect(foldSearchText("Bilişim")).toBe(foldSearchText("bilisim"));
  });
});

describe("matchesSearchTerms", () => {
  const fields = ["Med Kuaför", "Saç bakımı, kişisel bakım", "Kuaför", "Silvan", "Diyarbakır"];

  it("aksansız aramayı eşleştirir", () => {
    expect(matchesSearchTerms(fields, "kuafor")).toBe(true);
    expect(matchesSearchTerms(fields, "KUAFOR")).toBe(true);
    expect(matchesSearchTerms(fields, "sac bakimi")).toBe(true);
  });

  it("her terimin geçmesini ister", () => {
    expect(matchesSearchTerms(fields, "med kuafor")).toBe(true);
    expect(matchesSearchTerms(fields, "med nakliyat")).toBe(false);
  });

  it("ilgisiz aramayı eşleştirmez", () => {
    expect(matchesSearchTerms(fields, "pizza")).toBe(false);
  });

  it("boş aramada elemez", () => {
    expect(matchesSearchTerms(fields, "   ")).toBe(true);
  });

  it("boş alanlarla çökmez", () => {
    expect(matchesSearchTerms([null, undefined, "İrfan Nakliyat"], "irfan")).toBe(true);
  });
});

describe("ilikePattern", () => {
  it("joker ve virgülü etkisizleştirir", () => {
    expect(ilikePattern("%a_b,c")).toBe('"%ab c%"');
  });

  it("boş girdide desen üretmez", () => {
    expect(ilikePattern("   ")).toBeNull();
    expect(ilikePattern("%%")).toBeNull();
  });
});
