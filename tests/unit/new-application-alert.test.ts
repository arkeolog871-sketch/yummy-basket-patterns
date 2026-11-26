import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(__dirname, "../..", path), "utf8");

/**
 * Yeni işletme başvurusu geldiğinde kurucuya ve (yalnızca ilgili bölgedeki)
 * sayfa yöneticilerine bildirim gider. Daha önce bu olay hiç bildirilmiyordu;
 * kurucu/sayfa yöneticisi panele bakmadıkça başvurunun geldiğini bilemiyordu.
 */
describe("yeni başvuru bildirimi", () => {
  const alertFile = read("src/lib/business-application-alert.server.ts");
  const submitFile = read("src/lib/business-applications.functions.ts");

  it("başvuru kaydedildikten sonra kurucuya/admin'e ve bölgedeki sayfa yöneticisine bildirim gönderiyor", () => {
    expect(alertFile).toContain("export async function notifyFoundersOfNewApplication");
    expect(alertFile).toContain('.in("role", ["founder", "admin"])');
    expect(alertFile).toContain('.from("page_manager_roles")');
  });

  it("sayfa yöneticisi bildirimi başvurunun şehir/ilçesiyle eşleşenle sınırlı (panelde gördüğü başvuruyla aynı kapsam)", () => {
    const handler = alertFile.slice(
      alertFile.indexOf("export async function notifyFoundersOfNewApplication"),
    );
    expect(handler).toContain("normalizeRegionPart(row.city) === targetCity");
    expect(handler).toContain("normalizeRegionPart(row.district) === targetDistrict");
  });

  it("başvuran bildirimi (onay/red) hâlâ yerinde duruyor", () => {
    expect(alertFile).toContain("export async function notifyApplicantOfApplicationReview");
  });

  it("submitBusinessApplication, kayıt başarılı olduktan sonra kurucuyu uyarıyor", () => {
    const handler = submitFile.slice(submitFile.indexOf("export const submitBusinessApplication"));
    const insertIndex = handler.indexOf('from("business_applications").insert');
    const notifyIndex = handler.indexOf("notifyFoundersOfNewApplication");
    expect(insertIndex).toBeGreaterThan(-1);
    expect(notifyIndex).toBeGreaterThan(insertIndex);
  });

  it("bildirim hatası başvuru akışını bozmuyor (hata içeride yutuluyor)", () => {
    const handler = alertFile.slice(
      alertFile.indexOf("export async function notifyFoundersOfNewApplication"),
    );
    expect(handler).toMatch(/try \{[\s\S]*catch \(error\) \{[\s\S]*console\.error/);
  });
});
