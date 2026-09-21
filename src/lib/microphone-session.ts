/**
 * Mikrofon kaydının ömrünü yöneten küçük oturum nesnesi.
 *
 * NEDEN AYRI BİR DOSYA: kaydı başlatmak kolay, BIRAKMAK zor. getUserMedia ile
 * alınan akış durdurulmazsa mikrofon sayfanın elinde kalır ve bir sonraki
 * denemede tarayıcı NotReadableError atar — kullanıcı "Mikrofona ulaşılamadı,
 * başka bir uygulama kullanıyor olabilir" mesajını görür, oysa mikrofonu tutan
 * uygulamanın kendisidir. Bırakma yolları buraya toplandı ki hiçbiri
 * unutulmasın, ve tarayıcısız ortamda test edilebilsin.
 *
 * Tarayıcı türleri yerine küçük arayüzler kullanılıyor: sahte nesnelerle
 * ölçülebiliyor.
 */

/** getUserMedia'nın döndürdüğü akıştan ihtiyacımız olan kadarı. */
export interface AudioTrackLike {
  stop(): void;
}

export interface AudioStreamLike {
  getTracks(): AudioTrackLike[];
}

export interface RecorderLike {
  state: string;
  mimeType?: string;
  ondataavailable: ((event: { data: { size: number } }) => void) | null;
  onstop: (() => void) | null;
  start(): void;
  stop(): void;
}

export interface MicrophoneDeps {
  /** İzin isteyip ses akışını açar. */
  openStream(): Promise<AudioStreamLike>;
  /** Akıştan kaydedici üretir. Kurucu hata atabilir; oturum akışı yine bırakır. */
  createRecorder(stream: AudioStreamLike): RecorderLike;
  /** "Meşgul" hatasından sonraki tek yeniden deneme için bekleme. */
  sleep?(ms: number): Promise<void>;
}

/** Kullanıcıya gösterilecek mesajı seçmek için hata sınıflandırması. */
export type MicrophoneErrorKind = "denied" | "missing" | "busy" | "unknown";

export function classifyMicrophoneError(error: unknown): MicrophoneErrorKind {
  const name = (error as { name?: string } | null | undefined)?.name ?? "";
  // SecurityError: Permissions-Policy veya güvensiz köken. Kullanıcı için ikisi
  // de "izin yok" demek.
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  // Cihazda mikrofon yok ya da istenen kısıtı karşılayan aygıt yok.
  if (name === "NotFoundError" || name === "OverconstrainedError") return "missing";
  // Donanım açılamadı: başka bir uygulama (veya sızdırılmış kendi akışımız) tutuyor.
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") {
    return "busy";
  }
  return "unknown";
}

/** Meşgul hatasından sonra tek yeniden denemenin bekleme süresi. */
const RETRY_DELAY_MS = 500;

export class MicrophoneSession {
  private stream: AudioStreamLike | null = null;
  private recorder: RecorderLike | null = null;

  constructor(private readonly deps: MicrophoneDeps) {}

  /** Kayıt sürüyor mu (kaydedici gerçekten çalışıyor mu). */
  get active(): boolean {
    return this.recorder !== null && this.recorder.state !== "inactive";
  }

  /**
   * Kaydı başlatır. Önce elde kalmış bir akış varsa bırakır: aksi hâlde ikinci
   * deneme kendi tuttuğumuz mikrofon yüzünden "meşgul" hatası alır.
   *
   * Akış alındıktan SONRA oluşan her hata da akışı bırakır; yoksa mikrofon
   * sessizce açık kalır.
   */
  async start(onChunk: (chunk: { size: number }) => void, onStop: () => void): Promise<void> {
    this.release();
    let stream: AudioStreamLike;
    try {
      stream = await this.deps.openStream();
    } catch (error) {
      // Donanım "meşgul" derken bazen gerçekten geçici: az önce kapanan bir
      // ses oynatması ya da bırakılmakta olan başka bir uygulama. Kalıcı
      // engelde (cihaz anahtarı, izin) ikinci deneme de aynı hatayı verir,
      // maliyeti yarım saniye. BİR kez denenir; döngü yok.
      if (classifyMicrophoneError(error) !== "busy" || !this.deps.sleep) throw error;
      await this.deps.sleep(RETRY_DELAY_MS);
      stream = await this.deps.openStream();
    }
    this.stream = stream;
    try {
      const recorder = this.deps.createRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) onChunk(event.data);
      };
      recorder.onstop = () => {
        this.stopTracks();
        this.recorder = null;
        onStop();
      };
      this.recorder = recorder;
      recorder.start();
    } catch (error) {
      this.release();
      throw error;
    }
  }

  /**
   * Kaydı bitirir. Kaydedici çalışıyorsa onstop tetiklenir ve akışı orası
   * bırakır; çalışmıyorsa (hiç başlamamış veya çoktan durmuş) akış burada
   * bırakılır — bu dal olmadan mikrofon açık kalırdı.
   */
  stop(): void {
    const recorder = this.recorder;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
      return;
    }
    this.release();
  }

  /** Her şeyi koşulsuz bırakır. Birden çok kez çağrılabilir. */
  release(): void {
    const recorder = this.recorder;
    this.recorder = null;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      if (recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch {
          /* zaten durmuş olabilir; önemli olan aşağıdaki track.stop() */
        }
      }
    }
    this.stopTracks();
  }

  private stopTracks(): void {
    const stream = this.stream;
    this.stream = null;
    if (!stream) return;
    for (const track of stream.getTracks()) {
      try {
        track.stop();
      } catch {
        /* bırakılamayan tek bir kanal diğerlerini engellemesin */
      }
    }
  }
}
