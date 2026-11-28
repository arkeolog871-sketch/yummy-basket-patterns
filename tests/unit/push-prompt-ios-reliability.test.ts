import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(__dirname, "../..", path), "utf8");

const prompt = read("src/components/notifications/PushPermissionPrompt.tsx");
const iosPush = read("src/lib/ios-native-push.ts");

/**
 * YAŞANDI: "izin verdim ama sürekli soruyor" şikâyeti iki ayrı sebepten
 * geliyordu — (1) Safari'de (ana ekrana eklenmeden) bildirim Apple
 * tarafından teknik olarak imkânsız ama ekran yine de soruyordu; (2) native
 * uygulamada token bellekte tutulduğu için her soğuk açılışta Apple'dan
 * yeniden isteniyordu ve erken basılırsa "bir daha sorma" hiç işaretlenmeden
 * pes ediliyordu. Bu testler düzeltmenin kalıcı kalmasını garanti eder.
 */
describe("bildirim izni: iOS güvenilirlik düzeltmesi", () => {
  it("Safari'de (ana ekrana eklenmeden) imkânsız izni sormak yerine ana ekrana ekleme rehberi gösteriyor", () => {
    expect(prompt).toContain("detectIosInstallKind");
    expect(prompt).toContain('detectIosInstallKind() === "safari"');
    expect(prompt).toContain("showHomeScreenGuide");
    expect(prompt).toContain("Ana Ekrana Ekle");
  });

  it("tarayıcı teknik olarak desteklemiyorsa pencere hiç açılmıyor", () => {
    const start = prompt.indexOf("useEffect(() => {");
    const body = prompt.slice(start, prompt.indexOf("}, [user, checkStatus, web.status]);"));
    expect(body).toContain('web.status === "unsupported" || web.status === "unconfigured") return');
  });

  it("iOS'ta izin yalnızca kullanıcı 'İzin ver'e basınca isteniyor (soft-ask)", () => {
    expect(prompt).toContain("requestNativeIosNotificationPermission");
    expect(prompt).toContain("allowNativeIos");
    // Eski tek-seferlik getNativeIosFcmToken çağrısı artık doğrudan
    // kullanılmıyor; bekleyen/tekrar deneyen sürüm kullanılıyor.
    expect(prompt).not.toContain("import { getNativeIosFcmToken");
    expect(prompt).toContain("waitForNativeIosToken");
  });

  it("izin verilip token gelmezse hata kaydı düşüyor ve 30 gün sonra tekrar soruluyor", () => {
    const start = prompt.indexOf("const allowNativeIos");
    const body = prompt.slice(start, prompt.indexOf("const allow = async"));
    expect(body).toContain("reportError");
    expect(body).toContain('finish("declined")');
    expect(prompt).toContain("RETRY_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000");
  });

  it("'registered' durumu kalıcı, 'declined'/ipucu durumları zaman damgalı", () => {
    expect(prompt).toContain(
      'type StoredStatus = "registered" | "declined" | "home-screen-hint-shown"',
    );
    expect(prompt).toContain('saved?.status === "registered") return');
    expect(prompt).toContain("Date.now() - saved.at < RETRY_COOLDOWN_MS");
  });
});

describe("ios-native-push: soft-ask ve tekrar deneme yardımcıları", () => {
  it("requestNativeIosNotificationPermission köprü yoksa güvenli şekilde false dönüyor", () => {
    expect(iosPush).toContain("export async function requestNativeIosNotificationPermission");
    expect(iosPush).toContain("if (!hasNativeIosPush() || !cap?.nativePromise) return false;");
  });

  it("waitForNativeIosToken belirli bir süre kısa aralıklarla tekrar deniyor", () => {
    const start = iosPush.indexOf("export async function waitForNativeIosToken");
    const body = iosPush.slice(start);
    expect(body).toContain("maxWaitMs = 12_000");
    expect(body).toContain("stepMs = 2_000");
    expect(body).toContain("getNativeIosFcmToken()");
  });
});
