import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const fns = readFileSync("src/lib/compliance-review.functions.ts", "utf8");
const queue = readFileSync("src/components/founder/ComplianceReviewQueue.tsx", "utf8");
const store = readFileSync("src/routes/restoran.$slug.tsx", "utf8");

describe("uyum karar akışları", () => {
  it("kurucu kararları sunucuda kurucu yetkisiyle korunuyor", () => {
    for (const name of [
      "getReviewQueue",
      "decideBusinessDocument",
      "decideComplaint",
      "decideRefund",
      "decideContentReport",
      "createSecurityIncident",
      "updateSecurityIncident",
    ]) {
      const body = fns.slice(fns.indexOf(`export const ${name}`));
      expect(body.slice(0, 1400)).toMatch(/founderGuard\(context/);
    }
  });
  it("işletme yalnız kendi klasörüne belge bildirebilir", () => {
    expect(fns).toMatch(/startsWith\(`\$\{restaurantId\}\/`\)/);
    expect(fns).toMatch(/includes\("\.\."\)/);
  });
  it("belge reddi gerekçesiz yapılamaz, kritik kararlar ikinci onay ister", () => {
    expect(fns).toMatch(/Red gerekçesi zorunlu/);
    expect(queue).toMatch(/window\.confirm/);
  });
  it("içerik kaldırılınca yorum gizlenir ve gerekçe yazılır", () => {
    expect(fns).toMatch(/is_hidden: true, hidden_reason: data\.reason/);
  });
  it("yorumlarda doğrulanmış sipariş etiketi ve bildir düğmesi var", () => {
    expect(store).toContain("Doğrulanmış sipariş");
    expect(store).toContain("ReportReviewButton");
    expect(store).toContain("İşletmenin cevabı");
  });
});
