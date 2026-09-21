/**
 * Mikrofon hatasının SEBEBİNİ ölçen tanı toplayıcı.
 *
 * NEDEN: "Mikrofona ulaşılamadı" mesajı tek başına hiçbir şey söylemiyor.
 * Aynı mesajı en az dört ayrı durum üretiyor ve çözümleri birbirinden farklı:
 *
 *   1. Cihazda mikrofon hiç görünmüyor (Android'in cihaz geneli "Mikrofon
 *      erişimi" anahtarı kapalı olabilir; Hızlı Ayarlar'daki anahtar).
 *   2. Mikrofon görünüyor ama başka bir uygulama tutuyor (arama, ses kaydı).
 *   3. Uygulama/tarayıcı izni verilmemiş.
 *   4. Sayfa güvenli olmayan bir kökenden açılmış.
 *
 * Tahmin yürütmek yerine ölçülüyor: hata adı, sistemin saydığı ses girişi
 * sayısı, izin durumu, güvenli köken ve uygulamanın içinde mi çalıştığımız.
 * Sonuç kullanıcıya tek satır olarak gösteriliyor; ekran görüntüsü tek başına
 * teşhis için yeterli oluyor.
 *
 * Tarayıcı API'leri dışarıdan veriliyor: tarayıcısız ortamda ölçülebiliyor.
 */
import { classifyMicrophoneError, type MicrophoneErrorKind } from "./microphone-session";

export interface MicrophoneProbe {
  userAgent: string;
  secureContext: boolean;
  /** navigator.mediaDevices.enumerateDevices sarmalayıcısı. */
  listDevices?: () => Promise<{ kind: string; label?: string }[]>;
  /** navigator.permissions.query({ name: "microphone" }) sarmalayıcısı. */
  readPermission?: () => Promise<{ state: string }>;
}

export interface MicrophoneDiagnostics {
  kind: MicrophoneErrorKind;
  errorName: string;
  /** Sistemin saydığı ses girişi. null = ölçülemedi. */
  audioInputs: number | null;
  /**
   * Cihaz adı (label) dolu mu. Chromium aygıt adlarını YALNIZCA sayfaya
   * mikrofon izni gerçekten verildikten sonra dolduruyor. Boşsa izin
   * Chromium katmanında verilmemiş demektir — işletim sistemi izni verilmiş
   * görünse bile. Bu, "izin var ama donanım açılmıyor" ile "izin aslında
   * yok" durumlarını birbirinden ayıran tek ölçüm.
   */
  deviceLabels: boolean | null;
  /** WebView/tarayıcı Chromium sürümü; eski sürümlerde ses yakalama bozuk olabilir. */
  engineVersion: string | null;
  /** "granted" | "denied" | "prompt" | null (tarayıcı desteklemiyor). */
  permission: string | null;
  secureContext: boolean;
  /** Android sarmalayıcı WebView'i mi (kullanıcı aracısına "SilvanCebimde" ekliyor). */
  inApp: boolean;
}

export async function collectMicrophoneDiagnostics(
  error: unknown,
  probe: MicrophoneProbe,
): Promise<MicrophoneDiagnostics> {
  const name = (error as { name?: string } | null | undefined)?.name ?? "";

  let audioInputs: number | null = null;
  let deviceLabels: boolean | null = null;
  try {
    const devices = await probe.listDevices?.();
    if (devices) {
      const inputs = devices.filter((device) => device.kind === "audioinput");
      audioInputs = inputs.length;
      deviceLabels = inputs.some((device) => (device.label ?? "").trim().length > 0);
    }
  } catch {
    // enumerateDevices bazı WebView sürümlerinde patlıyor; tanı yüzünden
    // kullanıcıya ikinci bir hata göstermenin anlamı yok.
  }

  let permission: string | null = null;
  try {
    const status = await probe.readPermission?.();
    if (status) permission = status.state;
  } catch {
    // Firefox ve eski WebView'ler "microphone" adını bilmiyor.
  }

  return {
    kind: classifyMicrophoneError(error),
    errorName: name || "bilinmiyor",
    audioInputs,
    permission,
    deviceLabels,
    engineVersion: engineVersionOf(probe.userAgent),
    secureContext: probe.secureContext,
    inApp: probe.userAgent.includes("SilvanCebimde"),
  };
}

/** Kullanıcı aracısından Chromium ana sürümü. */
export function engineVersionOf(userAgent: string): string | null {
  const match = userAgent.match(/Chrome\/(\d+)/);
  return match?.[1] ?? null;
}

/** Ekran görüntüsünden okunabilecek tek satır. */
export function formatMicrophoneDiagnostics(diagnostics: MicrophoneDiagnostics): string {
  const parts = [
    diagnostics.errorName,
    `mikrofon: ${diagnostics.audioInputs === null ? "?" : diagnostics.audioInputs}`,
    `etiket: ${diagnostics.deviceLabels === null ? "?" : diagnostics.deviceLabels ? "var" : "yok"}`,
    `motor: ${diagnostics.engineVersion ?? "?"}`,
    `ortam: ${diagnostics.inApp ? "uygulama" : "tarayıcı"}`,
  ];
  // Güvenli köken normalde doğru; yalnızca bozukken yer kaplasın.
  if (!diagnostics.secureContext) parts.push("güvenli köken: HAYIR");
  return parts.join(" · ");
}

/**
 * Ölçüme dayalı, kullanıcının uygulayabileceği tek cümlelik yönlendirme.
 * Sıra önemli: en kesin ölçüm önce.
 */
export function microphoneAdvice(diagnostics: MicrophoneDiagnostics): string {
  if (!diagnostics.secureContext) {
    return "Sayfa güvenli bağlantıyla açılmamış; https adresinden girin.";
  }
  if (diagnostics.audioInputs === 0) {
    return diagnostics.inApp
      ? "Telefon hiç mikrofon görmüyor. Hızlı Ayarlar'da 'Mikrofon erişimi' anahtarını açın."
      : "Tarayıcı hiç mikrofon görmüyor. Cihazın mikrofon erişimi kapalı olabilir.";
  }
  if (diagnostics.permission === "denied") {
    return "İzin kalıcı olarak reddedilmiş. Ayarlar > Uygulamalar > Silvan Cebimde > İzinler'den mikrofonu açın.";
  }
  if (
    diagnostics.audioInputs !== null &&
    diagnostics.audioInputs > 0 &&
    diagnostics.deviceLabels === false
  ) {
    // Cihaz listede ama adı boş: izin Chromium katmanına hiç ulaşmamış.
    // Uygulamayı tamamen durdurup açmak bunu çözüyor; arka plandaki eski
    // süreç izni almadan önceki hâlini taşıyor olabilir.
    return diagnostics.inApp
      ? "Uygulama mikrofon iznini alamamış. Ayarlar > Uygulamalar > Silvan Cebimde > Zorla durdur deyip uygulamayı yeniden açın; izin penceresi çıkınca İzin Ver'i seçin."
      : "Tarayıcı bu site için mikrofon iznini almamış. Adres çubuğundaki kilit simgesinden mikrofona izin verin.";
  }
  if (diagnostics.kind === "busy") {
    // ÖLÇÜLEN durum: izin kapısı geçildi, cihaz listede görünüyor, ama
    // donanım açılmadı. Bunu üç şey yapar ve kullanıcı üçünü de kendi
    // kontrol edebilir; en sık görülenden başlayarak sıralı veriliyor.
    // "Başka uygulama" tek sebep sanılırsa cihaz anahtarı kapalı olan
    // kullanıcı boşuna uygulama kapatır.
    return diagnostics.inApp
      ? "Telefon mikrofonu uygulamaya vermedi. Sırayla deneyin: (1) arama/ses kaydı yapan uygulamayı kapatın, (2) Hızlı Ayarlar'da 'Mikrofon erişimi' açık olsun, (3) Ayarlar > Uygulamalar > Silvan Cebimde > İzinler'de mikrofon izinli olsun."
      : "Telefon mikrofonu tarayıcıya vermedi. Mikrofonu kullanan başka bir uygulama varsa kapatın; cihazın mikrofon erişimi de açık olmalı.";
  }
  if (diagnostics.kind === "denied") {
    return "Mikrofon izni verilmedi. İzin penceresi çıkmadıysa uygulamayı kapatıp yeniden açın.";
  }
  if (diagnostics.kind === "missing") {
    return "Bu cihazda kullanılabilir bir mikrofon bulunamadı.";
  }
  return "Ses kaydı başlatılamadı. Mesajınızı yazarak da gönderebilirsiniz.";
}
