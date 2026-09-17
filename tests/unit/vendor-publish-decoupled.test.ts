import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const founderServer = read("src/lib/founder.server.ts");
const founderFns = read("src/lib/founder.functions.ts");
const vendorDash = read("src/routes/vendor.dashboard.tsx");

/**
 * Yayına almak (is_active) artık vendor e-postasının doğrulanmasına bağlı
 * değil: kurucu işletmeyi yayına alır, vendor e-postasını işletme paneline
 * ilk girişte doğrular. Geçici e-posta arızası kurucuyu kilitlememeli.
 */
describe("yayın, e-posta doğrulamasından ayrık", () => {
  it("kaydetme is_active'i doğrulanmadı diye zorla pasife çekmiyor", () => {
    const start = founderFns.indexOf("export const saveBusiness");
    const body = founderFns.slice(start, founderFns.indexOf("export const deleteBusiness", start));
    // Eski zorlama kaldırıldı.
    expect(body).not.toContain(".update({ is_active: false })");
    expect(body).not.toContain("if (!vendor.emailVerified)");
  });

  it("yeni işletme kaydında is_active kurucunun seçimine bırakılıyor", () => {
    const start = founderFns.indexOf("export const saveBusiness");
    const body = founderFns.slice(start, founderFns.indexOf("export const deleteBusiness", start));
    // Insert artık is_active:false'u zorlamıyor.
    expect(body).not.toMatch(/insert\(\{[^}]*is_active: false/);
  });
});

/**
 * E-posta gönderimi başarısızsa hesap oluşturma/atama iptal olmamalı: hesap
 * kalır, vendor girişte doğrular. sendVendorSignupCode artık boolean döner,
 * hata fırlatmaz.
 */
describe("vendor doğrulama e-postası best-effort", () => {
  it("gönderim başarısızsa hata fırlatmıyor, false dönüyor", () => {
    const start = founderServer.indexOf("async function sendVendorSignupCode");
    const body = founderServer.slice(start, start + 700);
    expect(body).toContain("Promise<boolean>");
    expect(body).toContain("return false;");
    expect(body).not.toContain("throw new Error(EMAIL_SEND_FAILED_MESSAGE)");
  });

  it("yeni hesap yolu e-posta hatasında rollback yapmıyor", () => {
    // Kod gönderilemese bile geçerli hesap silinmemeli.
    expect(founderServer).not.toContain(
      "if (created) await rollbackNewVendorUser(matchedUserId, email);\n      throw error;",
    );
  });
});

/**
 * "Girişte doğrulama" mekanizması: doğrulanmamış vendor işletme paneline
 * girince 6 haneli kod ekranıyla karşılanır. Bu davranış korunmalı.
 */
describe("vendor girişte e-posta doğrulaması", () => {
  it("işletme paneli doğrulanmamış e-postada doğrulama ekranı gösteriyor", () => {
    expect(vendorDash).toContain("if (!emailVerified)");
    expect(vendorDash).toContain("E-posta doğrulama");
  });
});
