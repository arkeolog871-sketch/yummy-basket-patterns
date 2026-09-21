import { describe, expect, it } from "vitest";
import {
  collectMicrophoneDiagnostics,
  formatMicrophoneDiagnostics,
  microphoneAdvice,
  type MicrophoneProbe,
} from "@/lib/microphone-diagnostics";

const APP_UA = "Mozilla/5.0 (Linux; Android 14) Chrome/140 Mobile Safari/537.36 SilvanCebimde";
const BROWSER_UA = "Mozilla/5.0 (Linux; Android 14) Chrome/140 Mobile Safari/537.36";

function probe(over: Partial<MicrophoneProbe> = {}): MicrophoneProbe {
  return {
    userAgent: APP_UA,
    secureContext: true,
    listDevices: async () => [{ kind: "audioinput" }, { kind: "videoinput" }],
    readPermission: async () => ({ state: "granted" }),
    ...over,
  };
}

describe("mikrofon tanısı toplama", () => {
  it("hata adını, ses girişi sayısını ve izni ölçer", async () => {
    const d = await collectMicrophoneDiagnostics({ name: "NotReadableError" }, probe());
    expect(d).toEqual({
      kind: "busy",
      errorName: "NotReadableError",
      audioInputs: 1,
      permission: "granted",
      secureContext: true,
      inApp: true,
    });
  });

  it("yalnızca ses girişlerini sayar", async () => {
    const d = await collectMicrophoneDiagnostics(
      { name: "NotFoundError" },
      probe({
        listDevices: async () => [
          { kind: "videoinput" },
          { kind: "audiooutput" },
          { kind: "audioinput" },
          { kind: "audioinput" },
        ],
      }),
    );
    expect(d.audioInputs).toBe(2);
  });

  it("uygulama ile tarayıcıyı kullanıcı aracısından ayırır", async () => {
    const inApp = await collectMicrophoneDiagnostics({}, probe());
    const inBrowser = await collectMicrophoneDiagnostics({}, probe({ userAgent: BROWSER_UA }));
    expect(inApp.inApp).toBe(true);
    expect(inBrowser.inApp).toBe(false);
  });

  it("enumerateDevices patlarsa tanı yine döner", async () => {
    // Eski WebView sürümlerinde bu çağrı hata atıyor; tanının kendisi
    // kullanıcıya ikinci bir hata göstermemeli.
    const d = await collectMicrophoneDiagnostics(
      { name: "NotReadableError" },
      probe({
        listDevices: async () => {
          throw new Error("desteklenmiyor");
        },
      }),
    );
    expect(d.audioInputs).toBeNull();
    expect(d.errorName).toBe("NotReadableError");
  });

  it("permissions.query desteklenmiyorsa izin null kalır", async () => {
    const d = await collectMicrophoneDiagnostics(
      { name: "NotAllowedError" },
      probe({
        readPermission: async () => {
          throw new TypeError("microphone bilinmiyor");
        },
      }),
    );
    expect(d.permission).toBeNull();
    expect(d.kind).toBe("denied");
  });

  it("sıradan Error'ın adı olduğu gibi taşınır", async () => {
    const d = await collectMicrophoneDiagnostics(new Error("boom"), probe());
    expect(d.errorName).toBe("Error");
    expect(d.kind).toBe("unknown");
  });

  it("adı olmayan veya hata bile olmayan girdilerde çökmez", async () => {
    // Tarayıcılar bazen düz nesne veya metin atıyor; tanı yine dönmeli.
    for (const value of [null, undefined, "metin", {}, { name: "" }]) {
      const d = await collectMicrophoneDiagnostics(value, probe());
      expect(d.errorName).toBe("bilinmiyor");
      expect(d.kind).toBe("unknown");
    }
  });
});

describe("tanı satırı", () => {
  it("ekran görüntüsünden okunacak alanları taşır", async () => {
    const d = await collectMicrophoneDiagnostics({ name: "NotReadableError" }, probe());
    expect(formatMicrophoneDiagnostics(d)).toBe(
      "NotReadableError · mikrofon: 1 · izin: granted · ortam: uygulama",
    );
  });

  it("ölçülemeyen alanlar soru işareti olur", async () => {
    const d = await collectMicrophoneDiagnostics(
      { name: "NotFoundError" },
      { userAgent: BROWSER_UA, secureContext: true },
    );
    expect(formatMicrophoneDiagnostics(d)).toBe(
      "NotFoundError · mikrofon: ? · izin: ? · ortam: tarayıcı",
    );
  });

  it("güvenli köken yalnızca bozukken yazılır", async () => {
    const ok = await collectMicrophoneDiagnostics({ name: "SecurityError" }, probe());
    expect(ok).not.toHaveProperty("x");
    expect(formatMicrophoneDiagnostics(ok)).not.toContain("güvenli köken");

    const bad = await collectMicrophoneDiagnostics(
      { name: "SecurityError" },
      probe({ secureContext: false }),
    );
    expect(formatMicrophoneDiagnostics(bad)).toContain("güvenli köken: HAYIR");
  });
});

describe("yönlendirme ölçüme dayanır", () => {
  it("güvensiz köken her şeyin önüne geçer", async () => {
    const d = await collectMicrophoneDiagnostics(
      { name: "NotReadableError" },
      probe({ secureContext: false }),
    );
    expect(microphoneAdvice(d)).toContain("https");
  });

  it("hiç ses girişi yoksa cihaz geneli anahtara yönlendirir", async () => {
    // Android 12+ Hızlı Ayarlar'daki "Mikrofon erişimi" kapalıyken cihaz
    // listesi boşalıyor; bu durumda uygulama izniyle uğraşmak boşuna.
    const d = await collectMicrophoneDiagnostics(
      { name: "NotFoundError" },
      probe({ listDevices: async () => [{ kind: "videoinput" }] }),
    );
    expect(microphoneAdvice(d)).toContain("Mikrofon erişimi");
  });

  it("izin kalıcı reddedilmişse uygulama ayarlarına yönlendirir", async () => {
    const d = await collectMicrophoneDiagnostics(
      { name: "NotAllowedError" },
      probe({ readPermission: async () => ({ state: "denied" }) }),
    );
    expect(microphoneAdvice(d)).toContain("İzinler");
  });

  it("mikrofon görünüyor ama meşgulse başka uygulamayı işaret eder", async () => {
    const d = await collectMicrophoneDiagnostics({ name: "NotReadableError" }, probe());
    expect(microphoneAdvice(d)).toContain("başka bir uygulamada açık");
  });

  it("bilinmeyen hatada yazarak devam etmeyi önerir", async () => {
    const d = await collectMicrophoneDiagnostics(new Error("boom"), probe());
    expect(microphoneAdvice(d)).toContain("yazarak");
  });
});
