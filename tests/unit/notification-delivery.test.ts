import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");
/**
 * Yorumlar kusurun ne olduğunu anlatırken eski hatalı çağrıları anıyor;
 * iddialar yalnızca çalışan koda bakmalı.
 */
function codeOnly(path: string): string {
  return readFileSync(join(ROOT, path), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

const notifications = codeOnly("src/lib/notifications.server.ts");
const push = codeOnly("src/lib/push.server.ts");

/**
 * Duyuru bildirimleri hiçbir zaman kaydedilmedi: 17 duyuru gönderildi,
 * notifications tablosunda 0 satır vardı.
 *
 * Sebep, tekrarı önlemenin upsert'ün ON CONFLICT'ine bırakılmasıydı. Veritabanı
 * kuralı KISMİ bir indeks (WHERE source_type = 'admin_message' AND source_id IS
 * NOT NULL); Postgres aynı koşul verilmediğinde kısmi indeksi eşleştirmiyor ve
 * sorguyu planlama aşamasında 42P10 ile reddediyor. Üstüne Supabase istemcisi
 * hatayı fırlatmıyor, `{ error }` olarak döndürüyor -- kod o alana bakmadığı
 * için hata hiçbir yerde görünmedi.
 */
describe("duyuru bildirimi kaydı", () => {
  it("kısmi indeksle eşleşmeyen ON CONFLICT kullanmıyor", () => {
    expect(notifications).not.toContain("onConflict");
    expect(notifications).not.toMatch(/\.upsert\(/);
  });

  it("tekrarı kod tarafında eliyor", () => {
    expect(notifications).toContain('.eq("source_type", "admin_message")');
    expect(notifications).toContain('.in("source_id", sourceIds)');
    expect(notifications).toContain("already.has(");
  });

  /**
   * Asıl ders bu: Supabase hatayı döndürüyor, fırlatmıyor. Kontrol edilmeyen
   * her `{ error }` sessiz bir kusur demek.
   */
  it("her veritabanı çağrısının hatasını kontrol ediyor", () => {
    const calls = (notifications.match(/await supabaseAdmin/g) ?? []).length;
    const checked = (
      notifications.match(/const \{[^}]*\berror\b[^}]*\} = await supabaseAdmin/g) ?? []
    ).length;
    expect(calls).toBeGreaterThan(0);
    // Sonucu atılan tek bir çağrı bile sessiz bir kusur demek.
    expect(checked).toBe(calls);
    expect(notifications).toContain("recordAppError");
  });
});

/**
 * Gönderim hiçbir cihaza ulaşmadığında da kimse haberdar olmuyordu: duyuru
 * "gönderildi" görünüyor, telefonlarda hiçbir şey olmuyordu. Kayıtlı cihazı
 * olmayan bir hedef kitle, gönderenin bilmesi gereken bir durum.
 */
describe("gönderim görünürlüğü", () => {
  it("hiç cihaza ulaşmayan gönderimi bildiriyor", () => {
    expect(push).toContain("web === 0 && fcm === 0");
    expect(push).toContain("recordAppError");
  });

  it("gönderilen cihaz sayısını sayıyor", () => {
    expect(push).toMatch(/sendWebPush\([^)]*\): Promise<number>/);
    expect(push).toMatch(/sendFcmPush\([^)]*\): Promise<number>/);
  });

  /** Servis hesabı eksikse hiçbir cihaza bildirim gidemez; bu sessiz kalmamalı. */
  it("FCM yapılandırması eksikse söylüyor", () => {
    expect(push).toContain('result === "unconfigured"');
    expect(push).toContain("FCM servis hesabı tanımlı değil");
  });
});

/**
 * "Herkese duyuru" eskiden cihaz listesine tek tek gönderiliyordu ve token
 * yalnızca GİRİŞ YAPILMIŞ kullanıcı için kaydediliyordu. Sonuç: uygulamayı
 * kurup giriş yapmamış her telefon duyuruları hiç görmüyordu -- 14 kayıtlı
 * kullanıcıdan 8'inin cihazı yoktu.
 *
 * Konu yayınında cihaz açılışta bir kez abone oluyor ve sunucu tek mesajı
 * konuya gönderiyor: kurulu her uygulamaya ulaşıyor, giriş şartı yok, üstelik
 * cihaz sayısından bağımsız tek istek.
 */
describe("herkese duyuru yayını", () => {
  const fcm = codeOnly("src/lib/fcm.server.ts");
  const alert = codeOnly("src/lib/admin-message-alert.server.ts");
  const android = codeOnly(
    "android-wrapper/app/src/main/java/online/uygulamamcebimde/app/MainActivity.java",
  );
  const ios = codeOnly("ios/App/App/AppDelegate.swift");

  it("sunucu konu yayınını destekliyor", () => {
    expect(fcm).toContain("sendFcmTopicMessage");
    expect(fcm).toContain("FCM_BROADCAST_TOPIC");
  });

  it("herkese duyuru konuya gidiyor, cihaz listesine değil", () => {
    expect(alert).toContain('input.targetType === "all"');
    // Adın geçmesi yetmez, çağrılıyor olmalı: import satırı da adı içeriyor.
    expect(alert).toMatch(/await broadcastPush\(/);
    const start = alert.indexOf('input.targetType === "all"');
    const elseAt = alert.indexOf("} else {", start);
    expect(elseAt).toBeGreaterThan(start);
    // "all" dalında token listesine gönderim olmamalı.
    expect(alert.slice(start, elseAt)).not.toContain("sendPushToUserIds(");
  });

  /** Aynı bildirimi hem konudan hem token'dan göndermek iki kez gösterirdi. */
  it("yayınla birlikte ikinci bir token gönderimi yapmıyor", () => {
    const start = push.indexOf("export async function broadcastPush");
    expect(start).toBeGreaterThan(-1);
    const next = push.indexOf("export async function", start + 1);
    const body = push.slice(start, next === -1 ? undefined : next);
    expect(body).toContain("sendFcmTopicMessage");
    expect(body).not.toContain("sendFcmPush");
  });

  it("Android açılışta abone oluyor", () => {
    expect(android).toContain("subscribeToBroadcastTopic()");
    expect(android).toContain("subscribeToTopic(BROADCAST_TOPIC)");
  });

  it("iOS abone oluyor", () => {
    expect(ios).toContain("subscribe(toTopic: Self.broadcastTopic)");
  });

  /**
   * Konu adı üç yerde geçiyor ve üçü de birebir aynı olmak zorunda. Biri
   * kayarsa yayın o platforma hiç ulaşmaz ve hiçbir hata görünmez.
   */
  it("konu adı sunucu, Android ve iOS arasında aynı", () => {
    const server = /FCM_BROADCAST_TOPIC = "([^"]+)"/.exec(fcm)?.[1];
    const droid = /BROADCAST_TOPIC = "([^"]+)"/.exec(android)?.[1];
    const apple = /broadcastTopic = "([^"]+)"/.exec(ios)?.[1];
    expect(server).toBeTruthy();
    expect(droid).toBe(server);
    expect(apple).toBe(server);
  });
});
