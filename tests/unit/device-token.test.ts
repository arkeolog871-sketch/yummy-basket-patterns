import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");

function codeOnly(relative: string): string {
  return readFileSync(join(ROOT, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/**
 * FCM jetonu zamanla yenileniyor. Yalnızca `token` üzerinden upsert etmek,
 * yenilenen her jeton için yeni satır açıp eskisini bırakıyordu; eski jeton
 * bir süre daha geçerli olduğu için duyuru aynı telefona iki kez gidiyordu.
 */
describe("cihaz jetonu tekilliği", () => {
  const fn = codeOnly("src/lib/push.functions.ts");
  const bridge = codeOnly("src/hooks/useFcmTokenBridge.tsx");

  it("kayıt sırasında aynı cihazın önceki jetonlarını siliyor", () => {
    expect(fn).toContain('.eq("device_id", data.deviceId)');
    expect(fn).toContain('.neq("token", data.token)');
  });

  /**
   * Aynı telefonda hesap değiştirildiğinde jeton ikinci bir kullanıcının
   * altına da yazılıyor ve "herkese" duyuru o telefona iki kez düşüyordu.
   * Temizlik bu yüzden kullanıcıya değil cihaza göre yapılmalı.
   */
  it("temizlik kullanıcıya göre değil cihaza göre", () => {
    const handler = fn.slice(fn.indexOf("export const saveFcmToken"));
    const cleanup = handler.slice(0, handler.indexOf("upsert"));
    expect(cleanup).toContain('.eq("device_id", data.deviceId)');
    expect(cleanup).not.toContain('.eq("user_id", context.userId)');
    expect(cleanup).toContain("supabaseAdmin");
  });

  it("cihaz kimliğini kayda yazıyor", () => {
    expect(fn).toContain("device_id: data.deviceId");
  });

  it("cihaz kimliği olmadan da kayıt çalışıyor (eski sürümler)", () => {
    expect(fn).toMatch(/deviceId: z\.string\(\)[\s\S]{0,60}\.optional\(\)/);
    expect(fn).toContain("if (data.deviceId)");
  });

  it("temizlik hatası kaydı engellemiyor", () => {
    const handler = fn.slice(fn.indexOf("export const saveFcmToken"));
    expect(handler).toContain("cleanupError");
    expect(handler).not.toMatch(/cleanupError\)\s*throw/);
  });

  it("kimlik kurulum başına üretilip saklanıyor", () => {
    expect(bridge).toContain("readOrCreateDeviceId");
    expect(bridge).toContain("localStorage.getItem(DEVICE_ID_KEY)");
    expect(bridge).toContain("localStorage.setItem(DEVICE_ID_KEY");
  });

  it("localStorage erişilemezse kayıt yine yapılıyor", () => {
    const helper = bridge.slice(bridge.indexOf("function readOrCreateDeviceId"));
    expect(helper).toContain("return null");
    expect(bridge).toContain("...(deviceId ? { deviceId } : {})");
  });
});
