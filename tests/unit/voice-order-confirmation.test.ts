import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildOrderConfirmationSpeech,
  parseVoiceConfirmation,
} from "@/lib/voice-order-confirmation";
import type { CartProposal } from "@/lib/ai-assistant.types";

/**
 * Bu modülün "evet" demesi GERÇEK bir sipariş oluşturuyor: işletme hazırlığa
 * başlıyor. Bu yüzden testler onayın ne zaman verildiğinden çok, ne zaman
 * VERİLMEDİĞİNE bakıyor.
 */
describe("sesli onay çözümleme", () => {
  it("kısa ve net onaylar kabul edilir", () => {
    for (const text of [
      "evet",
      "Evet",
      "tamam",
      "olur",
      "onaylıyorum",
      "evet onayla",
      "tamamdır",
    ]) {
      expect(parseVoiceConfirmation(text), text).toBe("evet");
    }
  });

  it("ret cevapları sipariş oluşturmaz", () => {
    for (const text of ["hayır", "yok", "iptal", "vazgeçtim", "istemiyorum", "olmaz", "dur"]) {
      expect(parseVoiceConfirmation(text), text).toBe("hayir");
    }
  });

  it("evet ile başlayıp değişiklik isteyen cümle onay DEĞİLDİR", () => {
    // Kullanıcı siparişi değiştiriyor; onay sayılırsa yanlış sipariş gider.
    expect(parseVoiceConfirmation("evet ama bir de ayran ekle")).toBe("belirsiz");
    expect(parseVoiceConfirmation("tamam çıkar onu")).toBe("belirsiz");
  });

  it("uzun cümle onay sayılmaz", () => {
    expect(parseVoiceConfirmation("evet bu arada dün konuştuğumuz kahveyi de istiyorum")).toBe(
      "belirsiz",
    );
  });

  it("ret sözcüğü geçen cümle her hâlükârda reddir", () => {
    expect(parseVoiceConfirmation("tamam ama hayır")).toBe("hayir");
  });

  it("ilgisiz veya boş cevap belirsizdir", () => {
    for (const text of ["", "   ", "hangi kafeler açık", "bilmiyorum"]) {
      expect(parseVoiceConfirmation(text), text).toBe("belirsiz");
    }
  });

  it("Türkçe büyük harf I/İ farkı onayı bozmaz", () => {
    expect(parseVoiceConfirmation("TAMAM")).toBe("evet");
    expect(parseVoiceConfirmation("İPTAL")).toBe("hayir");
  });

  it("noktalama onayı bozmaz", () => {
    expect(parseVoiceConfirmation("Evet!")).toBe("evet");
    expect(parseVoiceConfirmation("evet, onayla.")).toBe("evet");
  });
});

const proposal: CartProposal = {
  restaurant: {
    id: "r1",
    slug: "kahve-diyari",
    name: "Kahve Diyarı",
    deliveryFee: 15,
    deliveryType: "kurye",
    minOrder: 50,
    deliveryMinutes: 30,
  },
  lines: [
    { menuItemId: "m1", name: "Filtre kahve", price: 45, quantity: 2, imageUrl: null },
    { menuItemId: "m2", name: "Cheesecake", price: 80, quantity: 1, imageUrl: null },
  ],
  subtotal: 170,
};

const address = { recipient_name: "İsmail Simpil", district: "Silvan", city: "Diyarbakır" };

describe("onay cümlesi", () => {
  const speech = buildOrderConfirmationSpeech(proposal, address);

  it("işletme, ürünler, toplam ve adres geçer", () => {
    expect(speech).toContain("Kahve Diyarı");
    expect(speech).toContain("2 Filtre kahve");
    expect(speech).toContain("Cheesecake");
    // 170 + 15 teslimat
    expect(speech).toContain("185 lira");
    expect(speech).toContain("İsmail Simpil");
    expect(speech).toContain("Silvan");
  });

  it("kapıda ödeme ve onay sorusu ile biter", () => {
    expect(speech).toContain("kapıda ödeme");
    expect(speech.trim().endsWith("Siparişi onaylıyor musunuz?")).toBe(true);
  });

  it("uzun sepette cümle şişmez", () => {
    // Sesli okunuyor: 20 kalemi tek tek saymak dakikalar sürerdi.
    const uzun: CartProposal = {
      ...proposal,
      lines: Array.from({ length: 20 }, (_, i) => ({
        menuItemId: `m${i}`,
        name: `Ürün ${i}`,
        price: 10,
        quantity: 1,
        imageUrl: null,
      })),
      subtotal: 200,
    };
    const metin = buildOrderConfirmationSpeech(uzun, address);
    expect(metin).toContain("ve diğerleri");
    expect(metin.length).toBeLessThan(400);
  });

  it("teslimat ücretsizse ondan söz edilmez", () => {
    const bedava = { ...proposal, restaurant: { ...proposal.restaurant, deliveryFee: 0 } };
    const metin = buildOrderConfirmationSpeech(bedava, address);
    expect(metin).not.toContain("Teslimat ücreti");
    expect(metin).toContain("170 lira");
  });

  it("kuruşlu tutar iki hane okunur", () => {
    const kurusiu = { ...proposal, subtotal: 170.5 };
    expect(buildOrderConfirmationSpeech(kurusiu, address)).toContain("185.50 lira");
  });
});

describe("sesli sipariş bağlantısı", () => {
  const assistant = readFileSync("src/components/assistant/OrderAssistant.tsx", "utf8");

  it("sesli sohbet turu voiceAsk'tan geçer", () => {
    expect(assistant).toContain("ask={voiceAsk}");
  });

  it("sipariş YALNIZCA onay çözümlemesinden sonra oluşturulur", () => {
    // Güvenlik sınırı: submitOrder tek bir yerde, o da placeVoiceOrder.
    // Başka bir yere eklenirse bu test kırılır ve sipariş yapay zekânın
    // niyet tahminiyle oluşabilir hâle gelirdi.
    const cagrilar = assistant.match(/submitOrder\(/g) ?? [];
    expect(cagrilar.length).toBe(1);

    const placeIndex = assistant.indexOf("async function placeVoiceOrder");
    const submitIndex = assistant.indexOf("submitOrder({");
    expect(placeIndex).toBeGreaterThan(-1);
    expect(submitIndex).toBeGreaterThan(placeIndex);

    // placeVoiceOrder yalnızca "evet" dalından çağrılıyor.
    const voiceAsk = assistant.slice(assistant.indexOf("async function voiceAsk"), placeIndex);
    expect(voiceAsk).toContain("parseVoiceConfirmation(said)");
    expect(voiceAsk).toMatch(/verdict === "evet"[\s\S]{0,120}placeVoiceOrder\(pending\)/);
  });

  it("şüpheli cevapta bekleyen sipariş temizlenir", () => {
    // "belirsiz" onay değildir; bekleyen öneri durmaya devam ederse sonraki
    // rastgele bir "tamam" siparişi oluştururdu.
    const voiceAsk = assistant.slice(
      assistant.indexOf("async function voiceAsk"),
      assistant.indexOf("async function placeVoiceOrder"),
    );
    expect(
      (voiceAsk.match(/pendingOrderRef\.current = null/g) ?? []).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("girişsiz veya adressiz kullanıcıda onay beklemeye alınmaz", () => {
    const voiceAsk = assistant.slice(
      assistant.indexOf("async function voiceAsk"),
      assistant.indexOf("async function placeVoiceOrder"),
    );
    const girisIndex = voiceAsk.indexOf("if (!user)");
    const adresIndex = voiceAsk.indexOf("if (!address)");
    const bekleyenIndex = voiceAsk.indexOf("pendingOrderRef.current = result.proposal");
    expect(girisIndex).toBeGreaterThan(-1);
    expect(adresIndex).toBeGreaterThan(-1);
    expect(bekleyenIndex).toBeGreaterThan(adresIndex);
  });
});
