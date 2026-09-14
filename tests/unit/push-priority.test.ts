import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");

const ANDROID_SRC = "android-wrapper/app/src/main/java/online/uygulamamcebimde/app";

const fcmServer = readFileSync(join(ROOT, "src/lib/fcm.server.ts"), "utf8");
const manifest = readFileSync(
  join(ROOT, "android-wrapper/app/src/main/AndroidManifest.xml"),
  "utf8",
);
const pushService = readFileSync(join(ROOT, `${ANDROID_SRC}/PushService.java`), "utf8");
const activity = readFileSync(join(ROOT, `${ANDROID_SRC}/MainActivity.java`), "utf8");

/**
 * Uygulama arka plandayken bildirimi bizim kodumuz değil, Firebase'in kendi
 * kodu gösteriyor. Mesajda kanal adı yazmazsa hangi kanalı kullanacağını
 * bilemiyor ve sistemin normal önemli varsayılan kanalına düşürüyor: bildirim
 * ekranın üstünde belirmiyor, titremiyor, sessizce listeye ekleniyor. Yani
 * uygulamanın yüksek önemli kanalı tam da en çok gerektiği anda —
 * uygulama kapalıyken — devre dışı kalıyor.
 */
describe("Android bildirim önceliği", () => {
  it("her mesajda yüksek önemli kanalı belirtiyor", () => {
    expect(fcmServer).toMatch(/channel_id:\s*ANDROID_CHANNEL_ID/);
    expect(fcmServer).toMatch(/const ANDROID_CHANNEL_ID = "orders"/);
  });

  it("Doze/uyku modunu delen yüksek öncelikle gönderiyor", () => {
    expect(fcmServer).toMatch(/priority:\s*"high"/);
    expect(fcmServer).toContain('notification_priority: "PRIORITY_MAX"');
  });

  it("sesi, titreşimi ve kilit ekranı görünürlüğünü açıkça istiyor", () => {
    expect(fcmServer).toContain("default_sound: true");
    expect(fcmServer).toContain("default_vibrate_timings: true");
    expect(fcmServer).toContain('visibility: "PUBLIC"');
  });

  /**
   * Kanal adı üç yerde geçiyor ve üçü de birebir aynı olmak zorunda: sunucu
   * mesajı, uygulamanın açılışta oluşturduğu kanal ve arka plan servisi.
   * Biri kayarsa mesaj var olmayan bir kanala gider ve Android sessizce
   * varsayılana düşer — hata vermez, sadece bildirim önemsizleşir.
   */
  it("kanal adı sunucu, uygulama ve servis arasında aynı", () => {
    const fromServer = /const ANDROID_CHANNEL_ID = "([^"]+)"/.exec(fcmServer)?.[1];
    const fromManifest = /default_notification_channel_id"\s*\n?\s*android:value="([^"]+)"/.exec(
      manifest,
    )?.[1];
    const fromService = /CHANNEL_ID = "([^"]+)"/.exec(pushService)?.[1];
    const fromActivity = /ORDER_CHANNEL_ID = "([^"]+)"/.exec(activity)?.[1];

    expect(fromServer).toBe("orders");
    expect(fromManifest).toBe(fromServer);
    expect(fromService).toBe(fromServer);
    expect(fromActivity).toBe(fromServer);
  });

  it("kanal adsız bir mesaj gelse bile varsayılanı yüksek önemli kanal", () => {
    expect(manifest).toContain("com.google.firebase.messaging.default_notification_channel_id");
  });

  it("uygulama kanalı yüksek önemle oluşturuyor", () => {
    expect(activity).toContain("NotificationManager.IMPORTANCE_HIGH");
    expect(pushService).toContain("NotificationManager.IMPORTANCE_HIGH");
  });
});

/**
 * Teslim edilemeyen mesajın varsayılan ömrü 4 hafta. Cihaz mesajı alamadığında
 * (zorla durdurulmuş uygulama, pil kısıtlaması, kapalı internet) Google onu
 * haftalarca saklıyor ve bağlantı kurulur kurulmaz hepsini birden boşaltıyor.
 * 1-2 Eylül'de gönderilen sekiz test bildirimi cihaza 14 Eylül'de tek seferde
 * düştü; sebebi buydu.
 */
describe("bayat bildirim", () => {
  it("mesaja ömür sınırı koyuyor", () => {
    expect(fcmServer).toMatch(/ttl:\s*ANDROID_TTL/);
  });

  it("ömür sınırı bir günü aşmıyor", () => {
    const ttl = /const ANDROID_TTL = "(\d+)s"/.exec(fcmServer)?.[1];
    expect(ttl).toBeDefined();
    expect(Number(ttl)).toBeGreaterThan(0);
    expect(Number(ttl)).toBeLessThanOrEqual(86_400);
  });

  /** Gecikmiş bildirim, teslim saatini değil gönderim saatini göstermeli. */
  it("kartta gönderim saatini gösteriyor", () => {
    expect(pushService).toContain("message.getSentTime()");
    expect(pushService).toContain("setWhen(sentTime)");
  });
});

/**
 * FCM "en az bir kez" teslim garantisi veriyor: aynı mesaj iki kez
 * gelebiliyor. Bildirim kimliği her seferinde o anki saatten türetilirse
 * ikinci teslimat ikinci bir kart açıyor ve kullanıcı aynı bildirimi iki
 * kere görüyor.
 */
describe("çift teslimat", () => {
  it("bildirim kimliğini mesajın kimliğinden türetiyor", () => {
    expect(pushService).toContain("message.getMessageId()");
    expect(pushService).toContain("manager.notify(notificationId");
    expect(pushService).not.toContain("manager.notify((int) System.currentTimeMillis()");
  });
});
