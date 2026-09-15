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
const pushServer = readFileSync(join(ROOT, "src/lib/push.server.ts"), "utf8");
const iosPlugin = readFileSync(join(ROOT, "ios/App/App/SilvanPushPlugin.swift"), "utf8");
const pbxproj = readFileSync(join(ROOT, "ios/App/App.xcodeproj/project.pbxproj"), "utf8");
const tokenBridge = readFileSync(join(ROOT, "src/hooks/useFcmTokenBridge.tsx"), "utf8");

/**
 * Mesaj `notification` taşıdığında ve uygulama ekranda değilken bildirimi
 * bizim kodumuz değil Firebase SDK'sı gösterir; `onMessageReceived` hiç
 * çağrılmaz. O yol denetimimizde olmayan şeylere bağlı: manifest'teki
 * varsayılan bildirim simgesi, üreticinin bildirim çekmecesi davranışı, kanal
 * geri düşüşü. "Uygulama açıkken geliyor, kapalıyken gelmiyor" tablosunun
 * sebebi buydu.
 *
 * Veri-only mesajda `onMessageReceived` her durumda çalışır ve bildirimi
 * PushService kurar: kanal, simge, öncelik, ses hep bizim kodumuzda.
 */
describe("Android bildirimini uygulamanın kendisi gösteriyor", () => {
  it("sunucu Android'e notification bloğu göndermiyor", () => {
    expect(fcmServer).not.toMatch(/^\s*notification:\s*\{\s*title:/m);
    expect(fcmServer).not.toContain("channel_id:");
    expect(fcmServer).not.toContain('notification_priority: "PRIORITY_MAX"');
  });

  it("başlık ve gövde data alanında gidiyor (PushService oradan okuyor)", () => {
    expect(fcmServer).toMatch(/data:\s*\{\s*\n\s*title: payload\.title/);
    expect(fcmServer).toContain("body: payload.body");
    expect(pushService).toContain('data.get("title")');
    expect(pushService).toContain('data.get("body")');
  });

  it("Doze/uyku modunu delen yüksek öncelikle gönderiyor", () => {
    expect(fcmServer).toMatch(/priority:\s*"high"/);
  });

  it("bildirimi yüksek önemli kanalda, silüet simgeyle kuruyor", () => {
    expect(pushService).toContain("NotificationCompat.PRIORITY_HIGH");
    expect(pushService).toContain("NotificationCompat.DEFAULT_ALL");
    expect(pushService).toContain("NotificationCompat.VISIBILITY_PUBLIC");
    expect(pushService).toContain("R.drawable.ic_stat_notify");
    expect(pushService).toContain("NotificationManager.IMPORTANCE_HIGH");
  });

  /**
   * Kanal adı üç yerde geçiyor ve üçü de birebir aynı olmak zorunda:
   * uygulamanın açılışta oluşturduğu kanal, arka plan servisi ve manifest
   * varsayılanı. Biri kayarsa bildirim var olmayan bir kanala gider ve
   * Android sessizce varsayılana düşer — hata vermez, sadece önemsizleşir.
   */
  it("kanal adı uygulama, servis ve manifest arasında aynı", () => {
    const fromManifest = /default_notification_channel_id"\s*\n?\s*android:value="([^"]+)"/.exec(
      manifest,
    )?.[1];
    const fromService = /CHANNEL_ID = "([^"]+)"/.exec(pushService)?.[1];
    const fromActivity = /ORDER_CHANNEL_ID = "([^"]+)"/.exec(activity)?.[1];

    expect(fromService).toBe("orders");
    expect(fromManifest).toBe(fromService);
    expect(fromActivity).toBe(fromService);
  });

  it("uygulama kanalı yüksek önemle oluşturuyor", () => {
    expect(activity).toContain("NotificationManager.IMPORTANCE_HIGH");
    expect(pushService).toContain("NotificationManager.IMPORTANCE_HIGH");
  });
});

/**
 * iOS'ta bildirimi APNs gösteriyor; üst düzey `notification` kaldırıldığı için
 * başlık ve gövde `aps.alert` içinde açıkça verilmeli. Verilmezse iPhone'a
 * sessiz bir mesaj gider ve hiçbir şey görünmez.
 */
describe("iOS bildirimi", () => {
  it("aps.alert içinde başlık ve gövde gönderiyor", () => {
    expect(fcmServer).toMatch(/alert:\s*\{\s*title: payload\.title, body: payload\.body\s*\}/);
  });
});

describe("bayat bildirim", () => {
  it("mesaja ömür sınırı koyuyor", () => {
    expect(fcmServer).toMatch(/ttl:\s*ANDROID_TTL/);
  });

  it("ömür sınırı bir günü aşmıyor", () => {
    expect(fcmServer).toContain("const ANDROID_TTL = `${TTL_SECONDS}s`");
    const ttl = /const TTL_SECONDS = ([\d_]+)/.exec(fcmServer)?.[1];
    expect(ttl).toBeDefined();
    const seconds = Number(ttl!.replace(/_/g, ""));
    expect(seconds).toBeGreaterThan(0);
    expect(seconds).toBeLessThanOrEqual(86_400);
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

/**
 * Telefonun pil yönetimi uygulamayı uykuya aldığında bildirim saatler sonra
 * düşebiliyor ve sunucu tarafında bunu aşacak hiçbir ayar yok: mesaj Google'a
 * ulaşıyor, Google cihaza ulaştırmaya çalışıyor, ama işletim sistemi
 * uygulamayı uyandırmıyor. Tek çözüm kullanıcının uygulamayı optimizasyondan
 * muaf tutması — WhatsApp'ın kurulumda istediği izin de budur.
 */
describe("pil optimizasyonu muafiyeti", () => {
  it("kullanıcıya muafiyeti bir kez öneriyor", () => {
    expect(activity).toContain("maybeOfferBatteryExemption");
    expect(activity).toContain("isIgnoringBatteryOptimizations");
  });

  it("muafiyet zaten varsa hiç sormuyor", () => {
    expect(activity).toMatch(
      /power\.isIgnoringBatteryOptimizations\(getPackageName\(\)\)\)\s*return;/,
    );
  });

  it("reddedilirse ısrar etmiyor", () => {
    const interval = /BATTERY_PROMPT_INTERVAL_MS = (\d+)L \* 24 \* 60 \* 60 \* 1000/.exec(activity);
    expect(interval).not.toBeNull();
    expect(Number(interval![1])).toBeGreaterThanOrEqual(7);
  });

  /**
   * Muafiyeti doğrudan isteyen izin Google Play politikasında kısıtlı ve
   * yayından kaldırma sebebi olabiliyor. Kullanıcıyı sistemin kendi ayar
   * ekranına yönlendirmek izin gerektirmiyor; sonuç aynı, risk yok. Bu izin
   * manifeste sonradan eklenirse uygulama reddedilebilir.
   */
  it("Play politikasında kısıtlı izni istemiyor", () => {
    expect(manifest).not.toContain("REQUEST_IGNORE_BATTERY_OPTIMIZATIONS");
    expect(activity).not.toContain("ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS");
    expect(activity).toContain("ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS");
  });

  /** O ekran bazı üretici ROM'larında yok; kullanıcı boşluğa düşmemeli. */
  it("ayar ekranı bulunamazsa yedek yola düşüyor", () => {
    expect(activity).toContain("ACTION_APPLICATION_DETAILS_SETTINGS");
    expect(activity).toContain("R.string.battery_prompt_failed");
  });
});

/**
 * iOS'ta bildirim altyapısının tamamı vardı — Firebase kuruluyor, izin
 * isteniyor, APNs kaydı yapılıyor, token üretiliyor — ama AppDelegate token'ı
 * `_ = fcmToken` ile çöpe atıyordu. Token sunucuya hiç ulaşmadığı için sunucu
 * iOS uygulamasına bildirim gönderemiyordu ve hiçbir yerde hata çıkmıyordu:
 * native iOS bildirimi sessizce hiç çalışmıyordu.
 */
describe("iOS bildirim kaydı", () => {
  it("native taraf token'ı web katmanına açıyor", () => {
    expect(iosPlugin).toContain('public let jsName = "SilvanPush"');
    expect(iosPlugin).toContain('CAPPluginMethod(name: "getFcmToken"');
  });

  /**
   * Capacitor iOS'ta eklenti taraması yapmıyor; derlenen sınıf Xcode
   * hedefinde yoksa hiç var olmuyor, varsa da packageClassList'e girmeden
   * kaydolmuyor. İkisi de sessizce başarısız olur.
   */
  it("eklenti Xcode hedefinde derleniyor", () => {
    expect(pbxproj).toContain("SilvanPushPlugin.swift in Sources */,");
  });

  it("token sunucuya kaydediliyor", () => {
    expect(tokenBridge).toContain("getNativeIosFcmToken");
    expect(tokenBridge).toContain("saveFcmToken");
  });
});

/**
 * Android'de önceliği kanal belirliyor; iOS'ta APNs başlıkları belirliyor.
 * Varsayılan apns-priority 5, "uygun bir zamanda teslim et" demek ve sistem
 * onu pil durumuna göre geciktirebiliyor. Ömür sınırı da Android'deki ttl'in
 * karşılığı; iOS'ta süre değil mutlak zaman damgası isteniyor.
 */
describe("iOS bildirim önceliği", () => {
  it("hemen teslim önceliğiyle gönderiyor", () => {
    expect(fcmServer).toContain('"apns-priority": "10"');
  });

  it("iOS tarafında da ömür sınırı koyuyor", () => {
    expect(fcmServer).toContain('"apns-expiration"');
    expect(fcmServer).toContain("Math.floor(Date.now() / 1000) + TTL_SECONDS");
  });

  it("sesi açıkça istiyor", () => {
    expect(fcmServer).toMatch(/sound:\s*"default"/);
  });
});

/** PWA/tarayıcı aboneleri de aynı kurala tabi olmalı. */
describe("web push", () => {
  it("bayat bildirimin düşmesi için ömür sınırı var", () => {
    expect(pushServer).toContain("TTL: WEB_PUSH_TTL_SECONDS");
  });

  it("acil olarak işaretleniyor", () => {
    expect(pushServer).toContain('urgency: "high"');
  });

  it("ömür sınırı FCM tarafıyla aynı", () => {
    const web = /WEB_PUSH_TTL_SECONDS = ([\d_]+)/.exec(pushServer)?.[1];
    const fcm = /TTL_SECONDS = ([\d_]+)/.exec(fcmServer)?.[1];
    expect(web).toBeDefined();
    expect(Number(web!.replace(/_/g, ""))).toBe(Number(fcm!.replace(/_/g, "")));
  });
});

/**
 * iOS'a teslimatı Google değil APNs yapıyor; Firebase bunun için bir APNs
 * anahtarına ihtiyaç duyuyor. Anahtar yoksa gönderim FCM'de ölür ve eski kod
 * yalnızca "401" yazıyordu — sebebi görünmediği için hata kodda aranırdı.
 */
describe("APNs yapılandırma hatası", () => {
  it("hata kodunu günlüğe yazıyor", () => {
    expect(fcmServer).toContain("fcmErrorCode");
    expect(fcmServer).toContain("errorCode");
  });

  it("APNs anahtarı eksikse sebebi açıkça söylüyor", () => {
    expect(fcmServer).toContain("THIRD_PARTY_AUTH_ERROR");
    expect(fcmServer).toContain("Cloud Messaging");
  });

  /** Gövdenin tamamı jeton ve bildirim metni içerebiliyor; günlüğe girmemeli. */
  it("hata gövdesinin tamamını günlüğe basmıyor", () => {
    expect(fcmServer).not.toMatch(/console\.error\([^)]*\btext\b/);
  });
});
