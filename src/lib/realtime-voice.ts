/**
 * Gerçek zamanlı sesli sohbet — istemci tarafı oturum mantığı.
 *
 * NEDEN YENİ MİMARİ: eski yol "kaydet → dosya yükle → yazıya çevir → model →
 * seslendirme → indir → oynat" zinciriydi. Her tur en az beş ağ gidiş-dönüşü
 * ve kaydın tamamının beklenmesi demekti; ölçümde kullanıcı sustuktan sonra
 * ilk sese kadar saniyeler geçiyordu. Burada tek bir WebRTC oturumu açılıyor:
 * mikrofon sürekli akıyor, konuşma başlangıcı/bitişi sunucuda (semantic VAD)
 * algılanıyor, yanıt sesi üretilirken parça parça çalıyor.
 *
 * GÜVENLİK: tarayıcı OPENAI_API_KEY görmez. Sunucu, geçit üzerinden kısa
 * ömürlü (≈1 dakika) bir istemci sırrı üretir; tarayıcı yalnız onu kullanır.
 *
 * ARAYA GİRME (barge-in): kullanıcı asistan konuşurken konuşmaya başlarsa
 * çalan ses ANINDA kesilir (`output_audio_buffer.clear`), üretilen yanıt
 * iptal edilir (`response.cancel`) ve yeni tur işlenir. Eski yanıtın kalan
 * parçaları bir daha çalmaz.
 *
 * İŞ MANTIĞI DEĞİŞMEDİ: model işletme/ürün bilgisini kendi kafasından
 * söylemez; `silvan_bilgi` aracıyla mevcut sipariş asistanına (veritabanı
 * araçlarıyla çalışan sunucu fonksiyonu) sorar ve cevabı seslendirir.
 */

export type RealtimePhase =
  | "baglaniyor"
  | "dinliyor"
  | "kullanici-konusuyor"
  | "dusunuyor"
  | "konusuyor";

/** Bir turun zaman damgaları (ms, monoton saat). */
export interface TurnMarks {
  speechStart?: number;
  speechEnd?: number;
  turnDetected?: number;
  responseStart?: number;
  firstAudio?: number;
  playbackStart?: number;
  responseEnd?: number;
}

export interface TurnLatency {
  /** Konuşma bitişi algılanana kadar geçen süre. */
  vad: number | null;
  /** Tur kapandıktan modelin yanıta başlamasına kadar. */
  llmFirstToken: number | null;
  /** ANA METRİK: kullanıcı sustu → ilk ses. */
  speechEndToFirstAudio: number | null;
  /** Yanıtın tamamı. */
  total: number | null;
}

function diff(a?: number, b?: number): number | null {
  return typeof a === "number" && typeof b === "number" ? Math.round(b - a) : null;
}

/** Zaman damgalarından gecikme metriklerini hesaplar. */
export function turnLatency(marks: TurnMarks): TurnLatency {
  return {
    vad: diff(marks.speechEnd, marks.turnDetected),
    llmFirstToken: diff(marks.turnDetected, marks.responseStart),
    speechEndToFirstAudio: diff(marks.speechEnd, marks.playbackStart ?? marks.firstAudio),
    total: diff(marks.speechStart, marks.responseEnd),
  };
}

/** Debug modunda konsola yazılan tek satırlık ölçüm dökümü. */
export function formatLatency(marks: TurnMarks, latency: TurnLatency): string {
  const base = marks.speechStart ?? 0;
  const rel = (value?: number) => (typeof value === "number" ? `${Math.round(value - base)}ms` : "—");
  return [
    "[VOICE LATENCY]",
    `speech_start: ${rel(marks.speechStart)}`,
    `speech_end: ${rel(marks.speechEnd)}`,
    `turn_detected: ${rel(marks.turnDetected)}`,
    `response_start: ${rel(marks.responseStart)}`,
    `first_audio: ${rel(marks.firstAudio)}`,
    `playback_start: ${rel(marks.playbackStart)}`,
    `response_end: ${rel(marks.responseEnd)}`,
    `| vad: ${latency.vad ?? "—"}`,
    `llm: ${latency.llmFirstToken ?? "—"}`,
    `speech_end→first_audio: ${latency.speechEndToFirstAudio ?? "—"}`,
    `total: ${latency.total ?? "—"}`,
  ].join(" ");
}

export interface RealtimeSessionSecret {
  token: string;
  model: string;
  /** WebRTC çağrı adresi (SDP alışverişi). */
  callUrl: string;
}

export interface RealtimeDeps {
  /** Sunucudan kısa ömürlü istemci sırrı ister. */
  mintSecret: () => Promise<RealtimeSessionSecret>;
  /** Veri kanalına JSON gönderir. */
  send: (payload: unknown) => void;
  /** Çalan sesi anında keser (yerel oynatma tarafı). */
  stopPlayback: () => void;
  /** Uygulamanın kendi asistanına soru sorar (veritabanı araçlarıyla). */
  answerQuestion: (question: string) => Promise<string>;
  onPhase: (phase: RealtimePhase) => void;
  onUserText: (text: string) => void;
  onAssistantText: (text: string) => void;
  onError: (message: string) => void;
  onLatency?: (marks: TurnMarks, latency: TurnLatency) => void;
  now: () => number;
  log?: (line: string) => void;
  /** Seslendirme sesi (ses kategorisi tercihinden gelir). */
  voice: string;
  instructions: string;
}

const TOOL_NAME = "silvan_bilgi";

/** Modelin oturum yapılandırması: sürekli dinleme + sunucu tarafı tur algısı. */
export function sessionUpdatePayload(voice: string, instructions: string, model: string) {
  return {
    type: "session.update",
    session: {
      type: "realtime",
      model,
      instructions,
      output_modalities: ["audio"],
      audio: {
        input: {
          format: { type: "audio/pcm", rate: 24000 },
          transcription: { model: "gpt-4o-transcribe", language: "tr" },
          // semantic_vad: sessizliğin süresine değil cümlenin bitmiş olup
          // olmadığına bakar. Nefes molası ve cümle arası duraklama turu
          // kapatmaz; kullanıcı gerçekten bitirdiğinde beklemeden kapatır.
          turn_detection: {
            type: "semantic_vad",
            eagerness: "medium",
            create_response: true,
            interrupt_response: true,
          },
        },
        output: { voice, speed: 1.05 },
      },
      tools: [
        {
          type: "function",
          name: TOOL_NAME,
          description:
            "Silvan Cebimde uygulamasındaki işletmeler, menüler, ürünler, fiyatlar, " +
            "çalışma saatleri ve sipariş adımları için TEK bilgi kaynağı. İşletme ya da " +
            "ürünle ilgili her soruda kullan; kendi bilginle cevap verme.",
          parameters: {
            type: "object",
            properties: {
              soru: { type: "string", description: "Kullanıcının sorusu, Türkçe." },
            },
            required: ["soru"],
            additionalProperties: false,
          },
        },
      ],
      tool_choice: "auto",
    },
  };
}

/**
 * Veri kanalı olaylarını işleyen durum makinesi.
 *
 * WebRTC bağlantısının kendisi bileşende kurulur; olay işleme burada ayrı
 * tutuluyor ki gerçek ses donanımı olmadan test edilebilsin.
 */
export class RealtimeTurnMachine {
  private marks: TurnMarks = {};
  private assistantBuffer = "";
  private speaking = false;
  private responseActive = false;

  constructor(private readonly deps: RealtimeDeps) {}

  /** Asistan şu an konuşuyor mu? (araya girme kararı buna bakıyor) */
  get isSpeaking(): boolean {
    return this.speaking;
  }

  configure(model: string) {
    this.deps.send(sessionUpdatePayload(this.deps.voice, this.deps.instructions, model));
    this.deps.onPhase("dinliyor");
  }

  async handle(event: { type?: string; [key: string]: unknown }): Promise<void> {
    const type = typeof event.type === "string" ? event.type : "";

    switch (type) {
      case "input_audio_buffer.speech_started": {
        this.marks = { speechStart: this.deps.now() };
        this.deps.onPhase("kullanici-konusuyor");
        // ARAYA GİRME: asistan konuşuyorsa derhal sus, yanıtı iptal et.
        if (this.speaking || this.responseActive) this.interrupt();
        return;
      }
      case "input_audio_buffer.speech_stopped": {
        this.marks.speechEnd = this.deps.now();
        return;
      }
      case "input_audio_buffer.committed": {
        this.marks.turnDetected = this.deps.now();
        this.deps.onPhase("dusunuyor");
        return;
      }
      case "response.created": {
        this.responseActive = true;
        this.marks.responseStart = this.deps.now();
        return;
      }
      case "response.output_audio.delta":
      case "output_audio_buffer.started": {
        if (this.marks.firstAudio === undefined) {
          this.marks.firstAudio = this.deps.now();
          this.marks.playbackStart = this.marks.firstAudio;
        }
        this.speaking = true;
        this.deps.onPhase("konusuyor");
        return;
      }
      case "conversation.item.input_audio_transcription.completed": {
        const text = typeof event["transcript"] === "string" ? event["transcript"].trim() : "";
        if (text) this.deps.onUserText(text);
        return;
      }
      case "response.output_audio_transcript.delta": {
        if (typeof event["delta"] === "string") this.assistantBuffer += event["delta"];
        return;
      }
      case "response.output_audio_transcript.done": {
        const text =
          typeof event["transcript"] === "string" ? event["transcript"] : this.assistantBuffer;
        this.assistantBuffer = "";
        if (text.trim()) this.deps.onAssistantText(text.trim());
        return;
      }
      case "response.function_call_arguments.done": {
        await this.runTool(event);
        return;
      }
      case "response.done": {
        this.responseActive = false;
        this.speaking = false;
        this.marks.responseEnd = this.deps.now();
        const latency = turnLatency(this.marks);
        this.deps.log?.(formatLatency(this.marks, latency));
        this.deps.onLatency?.(this.marks, latency);
        this.marks = {};
        this.deps.onPhase("dinliyor");
        return;
      }
      case "output_audio_buffer.stopped":
      case "output_audio_buffer.cleared": {
        this.speaking = false;
        return;
      }
      case "error": {
        // Gerçek hata gösterilir; sessizce başka sağlayıcıya geçilmez.
        const detail = event["error"] as { message?: unknown; code?: unknown } | undefined;
        const message = typeof detail?.message === "string" ? detail.message : "Bilinmeyen hata";
        const code = typeof detail?.code === "string" ? ` (${detail.code})` : "";
        this.deps.onError(`Gerçek zamanlı ses hatası${code}: ${message}`);
        return;
      }
      default:
        return;
    }
  }

  /** Çalan sesi kes, üretilen yanıtı iptal et; kalan parçalar çalmaz. */
  interrupt() {
    this.deps.stopPlayback();
    this.deps.send({ type: "output_audio_buffer.clear" });
    if (this.responseActive) this.deps.send({ type: "response.cancel" });
    this.speaking = false;
    this.responseActive = false;
    this.assistantBuffer = "";
  }

  private async runTool(event: { [key: string]: unknown }): Promise<void> {
    const name = typeof event["name"] === "string" ? event["name"] : "";
    const callId = typeof event["call_id"] === "string" ? event["call_id"] : "";
    if (name !== TOOL_NAME || !callId) return;
    let question = "";
    try {
      const parsed = JSON.parse(String(event["arguments"] ?? "{}")) as { soru?: unknown };
      question = typeof parsed.soru === "string" ? parsed.soru : "";
    } catch {
      question = "";
    }

    let output: string;
    try {
      output = await this.deps.answerQuestion(question);
    } catch (error) {
      output = `Bilgi alınamadı: ${error instanceof Error ? error.message : "bilinmeyen hata"}`;
    }

    this.deps.send({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output: JSON.stringify({ cevap: output.slice(0, 2000) }),
      },
    });
    // Aracın cevabı geldi: model hemen seslendirmeye başlasın.
    this.deps.send({ type: "response.create" });
  }
}
