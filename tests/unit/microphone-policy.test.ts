import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LEGAL_DOCUMENTS } from "@/lib/legal";
import { SECURITY_HEADERS } from "@/lib/security-wall.server";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

/**
 * Sesli asistanın mikrofonu, Permissions-Policy başlığında AÇIK olmak
 * zorunda. Boş liste — microphone=() — "hiçbir origin, kendimiz dâhil"
 * demektir ve getUserMedia'yı işletim sistemi izni verilmiş olsa bile
 * NotAllowedError ile reddettirir; kullanıcıya izin sorusu hiç sorulmaz.
 *
 * Yaşanmış hata: Android manifest'te RECORD_AUDIO ve WebView'de
 * RESOURCE_AUDIO_CAPTURE doğru kurulmuşken bile asistan "Mikrofon izni
 * verilmedi" diyordu; sebep bu başlıktı.
 */
describe("mikrofon Permissions-Policy başlığı", () => {
  it("sunucu başlığında microphone=(self) yazar", () => {
    const policy = SECURITY_HEADERS["Permissions-Policy"] ?? "";
    expect(policy).toContain("microphone=(self)");
    expect(policy).not.toContain("microphone=()");
  });

  it("statik _headers dosyalarında da mikrofon kapalı değildir", () => {
    // Sunucu başlığı düzeltilip bu dosyalar unutulursa hata geri gelir:
    // statik olarak sunulan yollar hâlâ kapalı başlığı taşır.
    for (const path of ["public/_headers", "ios/App/App/public/_headers"]) {
      const text = read(path);
      expect(text, `${path} mikrofonu kapatıyor`).not.toContain("microphone=()");
      expect(text, `${path} mikrofonu açmıyor`).toContain("microphone=(self)");
    }
  });

  it("kamera ve konum izinleri bozulmadı", () => {
    const policy = SECURITY_HEADERS["Permissions-Policy"] ?? "";
    expect(policy).toContain("camera=(self)");
    expect(policy).toContain("geolocation=(self)");
    // Kullanmadığımız güçlü yetenekler kapalı kalmalı.
    expect(policy).toContain("payment=()");
    expect(policy).toContain("usb=()");
  });

  it("gizlilik metinleri mikrofon ve yapay zekâ aktarımını açıklıyor", () => {
    // Uygulama mikrofon kaydını bir yapay zekâ sağlayıcısına gönderiyor.
    // Apple ve KVKK, gizlilik metninin uygulamanın gerçekte topladığı veriyi
    // karşılamasını istiyor; iOS incelemesinde eksik beyan ret sebebi.
    // Bu test, özellik kodda dururken metnin sessizce geri alınmasına izin
    // vermez.
    const assistant = read("src/components/assistant/OrderAssistant.tsx");
    expect(assistant, "asistan artık mikrofon kullanmıyorsa bu testi güncelle").toContain(
      "getUserMedia",
    );

    const privacy = LEGAL_DOCUMENTS.privacy.paragraphs.join(" ").toLocaleLowerCase("tr");
    expect(privacy).toContain("mikrofon");
    expect(privacy).toContain("yapay zekâ");
    // Ses kaydının saklanmadığı ve arka planda dinleme olmadığı yazmalı.
    expect(privacy).toContain("saklanmaz");
    expect(privacy).toContain("arka planda dinleme yapılmaz");

    const kvkk = LEGAL_DOCUMENTS.kvkk.paragraphs.join(" ").toLocaleLowerCase("tr");
    expect(kvkk).toContain("ses kaydı");
    expect(kvkk).toContain("yapay zekâ");
  });

  it("Android mikrofon zincirinin diğer halkaları yerinde", () => {
    // Başlık tek başına yetmiyor; üçü birden gerekiyor.
    const manifest = read("android-wrapper/app/src/main/AndroidManifest.xml");
    const activity = read(
      "android-wrapper/app/src/main/java/online/uygulamamcebimde/app/MainActivity.java",
    );
    expect(manifest).toContain("android.permission.RECORD_AUDIO");
    expect(activity).toContain("RESOURCE_AUDIO_CAPTURE");
    expect(activity).toContain("Manifest.permission.RECORD_AUDIO");
  });
});
