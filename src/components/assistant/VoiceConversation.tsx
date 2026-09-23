/**
 * Sesli sohbet ekranı — tam ekran, eller serbest.
 *
 * NEDEN AYRI BİR EKRAN: bir düğmeye basıp ses klibi kaydetmek "sesli not"tur,
 * sohbet değil. Burada döngü kendiliğinden dönüyor: dinle → yazıya çevir →
 * cevabı al → sesli oku → yeniden dinle. Kullanıcı ekrana hiç dokunmadan
 * konuşup cevap alabiliyor.
 *
 * İKİ ÖNEMLİ KURAL:
 * - Asistan konuşurken mikrofon KAPALI. Açık kalsa asistan kendi sesini
 *   duyup kendine cevap verirdi.
 * - Sessizliği kayıt bitişi sayma kararı sesin seviyesinden veriliyor
 *   (SpeechEndDetector); cümle arası nefes bitiş sanılmıyor.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import capedS from "@/assets/pelerinli-s.png";
import { CapeEmblem } from "./CapeEmblem";
import { RealtimeVoiceStage } from "./RealtimeVoiceStage";
import { DEFAULT_ASSISTANT_VOICE } from "@/lib/assistant-voices";
import {
  MicrophoneSession,
  type AudioStreamLike,
  type RecorderLike,
} from "@/lib/microphone-session";
import {
  collectMicrophoneDiagnostics,
  formatMicrophoneDiagnostics,
  microphoneAdvice,
} from "@/lib/microphone-diagnostics";
import { SpeechEndDetector, rmsLevel } from "@/lib/speech-end-detector";

/** Ekranda gösterilen durum. */
export type VoicePhase =
  "hazirlaniyor" | "dinliyor" | "yaziya-ceviriyor" | "dusunuyor" | "konusuyor";

const PHASE_LABEL: Record<VoicePhase, string> = {
  hazirlaniyor: "Mikrofon hazırlanıyor…",
  dinliyor: "Dinliyorum, konuşun",
  "yaziya-ceviriyor": "Anlıyorum…",
  dusunuyor: "Düşünüyorum…",
  konusuyor: "Konuşuyorum",
};

/** Seviye örnekleme aralığı; 100 ms hem yeterince sık hem ucuz. */
const SAMPLE_MS = 100;

/** Üst üste bu kadar tur başarısız olursa sohbet kapanır. */
const MAX_TURN_FAILURES = 3;

export interface VoiceConversationProps {
  /** Ses kaydını metne çevirir. */
  transcribe: (blob: Blob) => Promise<string>;
  /** Metni asistana gönderir, sesli okunacak yanıtı döndürür. */
  ask: (text: string) => Promise<string>;
  /** Yanıtı sesli okur; bitene kadar bekler. */
  speak: (text: string) => Promise<void>;
  /** Ekranı kapatır. */
  onClose: () => void;
  /** Son konuşulanlar (ekranda küçük döküm). */
  transcript: { role: "user" | "assistant"; content: string }[];
  /** Hata mesajı gösterir. */
  onError: (message: string, detail?: string) => void;
  /** Seçili ses kategorisi (gerçek zamanlı oturumda kullanılır). */
  voice?: string;
}

/**
 * Sesli sohbet giriş noktası.
 *
 * BİRİNCİL YOL gerçek zamanlıdır (tek WebRTC oturumu, sürekli dinleme, araya
 * girme). Bağlantı hiç kurulamazsa — geçit gerçek zamanlı ucu desteklemiyor,
 * ağ WebRTC'ye kapalı vb. — gerçek hata görünür biçimde bildirilir ve aynı
 * geçit üzerinden çalışan klasik tur döngüsüne düşülür. Sağlayıcı
 * DEĞİŞMEZ; yalnız aktarım biçimi değişir.
 */
export function VoiceConversation(props: VoiceConversationProps) {
  const [classic, setClassic] = useState(false);
  const [downgradeReason, setDowngradeReason] = useState<string | null>(null);

  if (!classic) {
    return (
      <RealtimeVoiceStage
        voice={props.voice ?? DEFAULT_ASSISTANT_VOICE}
        transcript={props.transcript}
        onClose={props.onClose}
        answerQuestion={props.ask}
        onUserText={() => {
          /* döküm üst bileşende tutuluyor; gerçek zamanlı modda anlık metin
             yalnız ekranda gösterilir */
        }}
        onAssistantText={() => {
          /* aynı sebep */
        }}
        onUnavailable={(reason) => {
          console.warn("[REALTIME] kullanılamıyor:", reason);
          setDowngradeReason(reason);
          setClassic(true);
        }}
      />
    );
  }

  return <ClassicVoiceConversation {...props} downgradeReason={downgradeReason} />;
}

function ClassicVoiceConversation({
  downgradeReason,
  transcribe,
  ask,
  speak,
  onClose,
  transcript,
  onError,
}: VoiceConversationProps & { downgradeReason?: string | null }) {
  const [phase, setPhase] = useState<VoicePhase>("hazirlaniyor");
  const [level, setLevel] = useState(0);
  const micRef = useRef<MicrophoneSession | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Ekran kapanırken uçuşta olan turun devam etmesini engeller.
  const liveRef = useRef(true);
  const busyRef = useRef(false);
  /**
   * Döngü açılışta bir kez kuruluyor ve kendi kendini çağırıyor; bu yüzden
   * ilk render'daki prop kapanışlarını ömür boyu taşırdı. Sonucu sessiz ama
   * ağır olurdu: ask, sohbet geçmişini sesli sohbet AÇILDIĞI andaki hâliyle
   * gönderirdi — asistan ikinci turdan itibaren bir önceki konuşulanı
   * görmez, her cevabı sıfırdan verirdi. Props ref'te tutuluyor ki her tur
   * güncel kapanışı çağırsın.
   */
  const propsRef = useRef({ transcribe, ask, speak, onClose, onError });
  propsRef.current = { transcribe, ask, speak, onClose, onError };
  // Üst üste anlaşılamayan tur sayısı. Tek bir "anlamadım" sohbeti
  // bitirmemeli; ama sonsuza kadar da denememeli.
  const failureRef = useRef(0);
  /** Kaydedicinin bildirdiği gerçek kap; blob bununla etiketlenir. */
  const recordedTypeRef = useRef<string>("audio/webm");

  // Gerçek zamanlı yol kurulamadıysa sebebi gizlemiyoruz: kullanıcı neden
  // klasik (daha yavaş) moda düşüldüğünü görüyor.
  const [hint, setHint] = useState<string | null>(downgradeReason ?? null);

  const stopMetering = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setLevel(0);
  }, []);

  const teardown = useCallback(() => {
    liveRef.current = false;
    stopMetering();
    micRef.current?.release();
    micRef.current = null;
    const context = audioContextRef.current;
    audioContextRef.current = null;
    void context?.close().catch(() => {
      /* zaten kapanmış olabilir */
    });
  }, [stopMetering]);

  /** Bir tur: dinle, yazıya çevir, cevap al, oku. Sonra kendini tekrar çağırır. */
  const runTurn = useCallback(async () => {
    if (!liveRef.current || busyRef.current) return;
    busyRef.current = true;
    // Hata mikrofonu AÇARKEN mi yoksa turun devamında mı oldu? İkisi ayrı
    // sorun: mikrofon açılamıyorsa sohbet süremez, ama anlaşılamayan tek bir
    // cümle sohbeti bitirmemeli. Eskiden ikisi de ekranı kapatıyor ve
    // kullanıcıya yanıltıcı bir mikrofon tanısı gösteriyordu.
    let stage: "mikrofon" | "tur" = "mikrofon";
    try {
      const session =
        micRef.current ??
        new MicrophoneSession({
          openStream: () =>
            navigator.mediaDevices.getUserMedia({ audio: true }) as Promise<AudioStreamLike>,
          createRecorder: (stream) => {
            const mimeType = ["audio/webm", "audio/mp4", "audio/ogg"].find((type) =>
              MediaRecorder.isTypeSupported(type),
            );
            const recorder = new MediaRecorder(
              stream as unknown as MediaStream,
              mimeType ? { mimeType } : undefined,
            );
            // Kaydın GERÇEK kabı saklanır. Eskiden blob koşulsuz "audio/webm"
            // etiketleniyordu; iOS Safari mp4 üretiyor ve yazıya çevirme ucu
            // mp4 içeriği webm adıyla alınca biçimi reddediyordu.
            recordedTypeRef.current = recorder.mimeType || mimeType || "audio/webm";
            return recorder as unknown as RecorderLike;
          },
          sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        });
      micRef.current = session;

      const chunks: Blob[] = [];
      const blob = await new Promise<Blob | null>((resolve, reject) => {
        session
          .start(
            (chunk) => chunks.push(chunk as Blob),
            () => resolve(new Blob(chunks, { type: recordedTypeRef.current || "audio/webm" })),
          )
          .then(() => {
            if (!liveRef.current) return;
            setPhase("dinliyor");
            beginMetering(session, resolve);
          })
          .catch(reject);
      });

      stopMetering();
      stage = "tur";
      if (!liveRef.current) return;
      // Boş kayıt: kullanıcı konuşmadı. Sessizce yeniden dinlemeye dön.
      if (!blob || blob.size < 1200) {
        busyRef.current = false;
        void runTurn();
        return;
      }

      setPhase("yaziya-ceviriyor");
      const said = await propsRef.current.transcribe(blob);
      if (!liveRef.current) return;
      if (!said.trim()) {
        busyRef.current = false;
        void runTurn();
        return;
      }

      setPhase("dusunuyor");
      const reply = await propsRef.current.ask(said);
      if (!liveRef.current) return;

      if (reply.trim()) {
        setPhase("konusuyor");
        // Mikrofon bu sırada kapalı: asistan kendi sesini duymasın.
        await propsRef.current.speak(reply);
      }
      if (!liveRef.current) return;
      failureRef.current = 0;
      setHint(null);
      busyRef.current = false;
      void runTurn();
    } catch (error) {
      busyRef.current = false;
      stopMetering();
      if (!liveRef.current) return;

      if (stage === "mikrofon") {
        const diagnostics = await collectMicrophoneDiagnostics(error, {
          userAgent: typeof navigator === "undefined" ? "" : navigator.userAgent,
          secureContext: typeof window !== "undefined" && window.isSecureContext,
          listDevices: () => navigator.mediaDevices.enumerateDevices(),
          nativeProbe: () =>
            (
              window as unknown as { SilvanNative?: { micDiagnostics?: () => string } }
            ).SilvanNative?.micDiagnostics?.(),
        });
        propsRef.current.onError(
          microphoneAdvice(diagnostics),
          formatMicrophoneDiagnostics(diagnostics),
        );
        propsRef.current.onClose();
        return;
      }

      // Turun devamında hata: ses anlaşılmamış, model cevap verememiş ya da
      // seslendirme düşmüş olabilir. Sohbeti bitirme, tekrar dinlemeye dön.
      failureRef.current += 1;
      const reason = error instanceof Error ? error.message : "Bir şey ters gitti.";
      if (failureRef.current >= MAX_TURN_FAILURES) {
        propsRef.current.onError("Sesli sohbeti sürdüremedim.", reason);
        propsRef.current.onClose();
        return;
      }
      setHint(reason);
      void runTurn();
    }
    // beginMetering aynı kapsamda tanımlı; bağımlılığa gerek yok.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopMetering]);

  /** Akışa çözümleyici bağlar ve konuşma bitince kaydı durdurur. */
  function beginMetering(session: MicrophoneSession, _resolve: (blob: Blob | null) => void) {
    const stream = session.currentStream as unknown as MediaStream | null;
    if (!stream) return;
    const AudioContextCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) {
      // Seviye ölçemeyen tarayıcıda sohbet yine dönsün: sabit süre sonra bitir.
      timerRef.current = setTimeout(() => session.stop(), 6000) as unknown as ReturnType<
        typeof setInterval
      >;
      return;
    }
    const context = audioContextRef.current ?? new AudioContextCtor();
    audioContextRef.current = context;
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    const buffer = new Float32Array(analyser.fftSize);
    const detector = new SpeechEndDetector();
    const startedAt = Date.now();

    timerRef.current = setInterval(() => {
      analyser.getFloatTimeDomainData(buffer);
      const value = rmsLevel(buffer);
      setLevel(value);
      const verdict = detector.push(value, Date.now() - startedAt);
      if (verdict === "devam") return;
      stopMetering();
      source.disconnect();
      // "bos" da "bitti" de kaydı durdurur; boş olanı yukarısı eler.
      session.stop();
    }, SAMPLE_MS);
  }

  useEffect(() => {
    liveRef.current = true;
    void runTurn();
    return teardown;
    // Yalnızca açılışta bir kez kurulsun; döngü kendi kendini sürdürüyor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lastUser = [...transcript].reverse().find((m) => m.role === "user");
  const lastAssistant = [...transcript].reverse().find((m) => m.role === "assistant");

  return (
    // Karanlık siyah sahne: pelerinli amblem parlak olduğu için koyu zeminde
    // okunuyor; ekran "konuşma modunda" olduğunu tek bakışta anlatıyor.
    // Renkler sabit koyu tonlarda tutuluyor (tema açık olsa da sahne karanlık).
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-white">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="font-semibold">Sesli sohbet</p>
        <button
          type="button"
          onClick={() => {
            teardown();
            onClose();
          }}
          aria-label="Sesli sohbeti kapat"
          className="flex size-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        <div
          aria-hidden
          className="relative flex size-64 items-center justify-center transition-transform"
          style={
            phase === "dinliyor"
              ? { transform: `scale(${1 + Math.min(level * 3, 0.3)})` }
              : undefined
          }
        >
          <span
            className={`absolute inset-6 rounded-full blur-2xl ${
              phase === "dinliyor" ? "bg-red-500/25" : "bg-white/5"
            }`}
          />
          <CapeEmblem
            src={capedS}
            paused={phase === "hazirlaniyor"}
            scale={phase === "dinliyor" ? 11 : 7}
            className={`relative w-56 drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)] ${
              phase === "hazirlaniyor" ? "opacity-70" : ""
            }`}
          />
          {phase === "yaziya-ceviriyor" || phase === "dusunuyor" ? (
            <Loader2 className="absolute bottom-0 size-6 animate-spin text-white/80" />
          ) : null}
        </div>

        <p aria-live="polite" className="text-lg font-medium">
          {PHASE_LABEL[phase]}
        </p>

        {hint ? <p className="max-w-md text-sm text-red-300">{hint}</p> : null}

        {lastUser ? (
          <p className="max-w-md text-sm text-white/60">“{lastUser.content}”</p>
        ) : (
          <p className="max-w-md text-sm text-white/60">
            Ne istediğinizi söyleyin. Örneğin: “Silvan’da açık kafe var mı?”
          </p>
        )}
        {lastAssistant ? (
          <p className="max-h-40 max-w-md overflow-y-auto text-base text-white">
            {lastAssistant.content}
          </p>
        ) : null}
      </div>

      <div className="px-6 pb-8 text-center">
        <button
          type="button"
          onClick={() => {
            teardown();
            onClose();
          }}
          className="text-sm text-white/60 underline"
        >
          Yazışmaya dön
        </button>
      </div>
    </div>
  );
}
