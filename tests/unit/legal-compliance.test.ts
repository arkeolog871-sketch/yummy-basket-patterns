import { describe, expect, it } from "vitest";
import { LEGAL_CENTER_ORDER, LEGAL_DOCUMENTS, LEGAL_VERSIONS, legalDocBySlug } from "@/lib/legal";
import {
  businessPublishBlockers,
  identityMissingFields,
  isDuplicatePaymentEvent,
  marketingAllowed,
} from "@/lib/compliance";

const allText = Object.values(LEGAL_DOCUMENTS)
  .flatMap((d) => d.paragraphs)
  .join("\n");

describe("yasal belgeler", () => {
  it("her belgenin sürümü var ve Yasal Merkez'de listeleniyor", () => {
    for (const id of Object.keys(LEGAL_DOCUMENTS)) {
      expect(LEGAL_VERSIONS[id as keyof typeof LEGAL_VERSIONS]).toBeGreaterThan(0);
      expect(LEGAL_CENTER_ORDER).toContain(id);
    }
  });
  it("son kullanıcıya yer tutucu ve mutlak sorumsuzluk hükmü bırakmıyor", () => {
    expect(allText).not.toMatch(/DOLDURULACAK/);
    expect(allText).not.toMatch(/hiçbir durumda platform sorumlu değildir|tüm sorumluluk işletmeye aittir/i);
    expect(allText).not.toMatch(/işletmeyle birlikte belirlenir/);
  });
  it("aydınlatma metni rıza/onay olarak sunulmuyor", () => {
    expect(LEGAL_DOCUMENTS.kvkk.paragraphs[0]).toMatch(/onay veya açık rıza metni değildir/);
  });
  it("/yasal/slug çözümleniyor", () => {
    expect(legalDocBySlug("isletme-sozlesmesi")?.id).toBe("vendor_agreement");
    expect(legalDocBySlug("yok")).toBeNull();
  });
});

describe("uyum kuralları", () => {
  it("S: platform kimliği eksikse yayına hazır değil", () => {
    expect(identityMissingFields({ legal_name: "X" })).toContain("Vergi / TC kimlik no");
  });
  it("C: belge eksik/süresi dolmuşsa yayın engeli", () => {
    const req = ["tax_certificate", "food_registration"];
    expect(businessPublishBlockers(req, [])).toEqual(req);
    expect(
      businessPublishBlockers(
        req,
        [
          { doc_kind: "tax_certificate", status: "approved", expires_at: null },
          { doc_kind: "food_registration", status: "approved", expires_at: "2020-01-01" },
        ],
        "2026-09-24",
      ),
    ).toEqual(["food_registration"]);
  });
  it("B: izin yoksa veya ret sonrasında pazarlama gönderilmez", () => {
    expect(marketingAllowed([], "email")).toBe(false);
    expect(
      marketingAllowed(
        [
          { channel: "email", granted: true, created_at: "2026-01-01" },
          { channel: "email", granted: false, created_at: "2026-02-01" },
        ],
        "email",
      ),
    ).toBe(false);
  });
  it("Q: tekrar gelen ödeme olayı ikinci kez işlenmez", () => {
    const seen = new Set<string>();
    expect(isDuplicatePaymentEvent(seen, "evt_1")).toBe(false);
    expect(isDuplicatePaymentEvent(seen, "evt_1")).toBe(true);
  });
});
