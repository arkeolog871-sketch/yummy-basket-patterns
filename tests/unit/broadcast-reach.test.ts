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
 * Yayın konusuna abonelik Android 2.15 ve iOS build 26 ile geldi. Kurulu eski
 * sürümler konuya abone değil; yalnızca konuya göndermek onları kayıtlı
 * cihazları olduğu hâlde tamamen dışarıda bırakıyordu.
 */
describe("herkese duyuru", () => {
  const push = codeOnly("src/lib/push.server.ts");

  it("konunun yanında kayıtlı cihazlara da gönderiyor", () => {
    expect(push).toContain("sendFcmTopicMessage(payload)");
    expect(push).toContain("sendFcmToAllTokens(payload)");
  });

  it("kayıtlı cihaz sorgusu kullanıcıya göre süzülmüyor", () => {
    const fn = push.slice(push.indexOf("async function sendFcmToAllTokens"));
    expect(fn).toContain('from("fcm_tokens").select("id, token")');
    expect(fn).not.toContain('.in("user_id"');
  });

  it("gerçekte ulaşılan cihaz sayısını döndürüyor", () => {
    expect(push).toContain("devices: tokens");
    expect(push).not.toContain("devices: -1");
  });

  /** "Gönderdim ama gelmedi" durumu tahminle değil kayıtla çözülmeli. */
  it("başarısız gönderimin sebebini hata kaydına yazıyor", () => {
    const fn = push.slice(push.indexOf("async function sendFcmToAllTokens"));
    expect(fn).toContain("sendFcmMessageReport");
    expect(fn).toContain("başarısızlar:");
    expect(fn).toContain("recordAppError");
  });

  it("geçersiz token'ı siliyor", () => {
    const fn = push.slice(push.indexOf("async function sendFcmToAllTokens"));
    expect(fn).toContain('result === "invalid_token"');
  });
});

describe("çift bildirim koruması", () => {
  const fcm = codeOnly("src/lib/fcm.server.ts");
  const alert = codeOnly("src/lib/admin-message-alert.server.ts");

  it("duyuru kimliği daraltma anahtarı olarak taşınıyor", () => {
    expect(alert).toContain("collapseKey: input.messageId");
  });

  it("Android tarafında notification.tag olarak gidiyor", () => {
    expect(fcm).toContain("tag: payload.collapseKey");
  });

  it("iOS tarafında apns-collapse-id olarak gidiyor", () => {
    expect(fcm).toContain('"apns-collapse-id"');
  });

  it("anahtar APNs sınırına kırpılıyor", () => {
    expect(fcm).toContain("payload.collapseKey.slice(0, 64)");
  });
});
