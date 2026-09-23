/**
 * Gerçek zamanlı sesli sohbet bağlantısı (WebRTC).
 *
 * Tek oturum: mikrofon akışı sürekli açık kalır, her cümlede yeni bağlantı,
 * yeni kimlik doğrulama ya da yeni model kurulumu yapılmaz. Ses yanıtı ayrı
 * bir medya izinden akar; ilk parça geldiği anda çalmaya başlar (dosya
 * indirilmesi beklenmez).
 *
 * MOBİL: uzak ses `playsinline` + `autoplay` ile çalınır ve oturum kullanıcı
 * dokunmasıyla açıldığı için iOS/Android oynatma izni sağlanır. Bluetooth
 * kulaklık, hoparlör/ahize seçimi ve çağrı kesintisi işletim sisteminin ses
 * yönlendirmesine bırakılır: WebRTC izi varsayılan iletişim cihazını
 * kullanır, kulaklık takılıp çıkarıldığında yönlendirme kendiliğinden döner.
 * Uygulama arka plana geçtiğinde mikrofon izi susturulur, öne döndüğünde
 * yeniden açılır; böylece görünmeyen bir oturum konuşmaya devam etmez.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createRealtimeVoiceSession } from "@/lib/realtime-voice.functions";
import {
  RealtimeTurnMachine,
  type RealtimePhase,
  type TurnLatency,
  type TurnMarks,
} from "@/lib/realtime-voice";

const INSTRUCTIONS =
  "Sen Silvan Cebimde uygulamasının sesli asistanısın. Yalnızca Türkçe konuş. " +
  "Kısa, sıcak ve net cümleler kur. İşletme, menü, ürün, fiyat, çalışma saati ve " +
  "sipariş adımlarıyla ilgili HER soruda silvan_bilgi aracını kullan ve yalnız " +
  "aracın döndürdüğü bilgiyi söyle. Uygulamada olmayan bir işletmeyi asla uydurma.";

export interface UseRealtimeVoiceOptions {
  voice: string;
  answerQuestion: (question: string) => Promise<string>;
  onUserText: (text: string) => void;
  onAssistantText: (text: string) => void;
  /** Bağlantı hiç kurulamadı: çağıran taraf klasik moda döner. */
  onUnavailable: (reason: string) => void;
  /** Oturum sırasındaki hatalar (ekranda ipucu olarak gösterilir). */
  onError: (reason: string) => void;
  debug?: boolean;
}

export function useRealtimeVoice({
  voice,
  answerQuestion,
  onUserText,
  onAssistantText,
  onUnavailable,
  onError,
  debug = true,
}: UseRealtimeVoiceOptions) {
  const mint = useServerFn(createRealtimeVoiceSession);
  const [phase, setPhase] = useState<RealtimePhase>("baglaniyor");
  const [latency, setLatency] = useState<TurnLatency | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const machineRef = useRef<RealtimeTurnMachine | null>(null);
  const liveRef = useRef(true);
  // Geri çağrımlar her render'da değişiyor; oturum bir kez kuruluyor.
  const cbRef = useRef({ answerQuestion, onUserText, onAssistantText, onUnavailable, onError });
  cbRef.current = { answerQuestion, onUserText, onAssistantText, onUnavailable, onError };

  const teardown = useCallback(() => {
    liveRef.current = false;
    channelRef.current?.close();
    channelRef.current = null;
    machineRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    const element = audioRef.current;
    audioRef.current = null;
    if (element) {
      element.pause();
      element.srcObject = null;
    }
  }, []);

  useEffect(() => {
    liveRef.current = true;

    void (async () => {
      try {
        const secret = await mint({});
        if (!liveRef.current) return;

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        if (!liveRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;

        const pc = new RTCPeerConnection();
        pcRef.current = pc;

        const element = new Audio();
        element.autoplay = true;
        element.setAttribute("playsinline", "true");
        audioRef.current = element;
        pc.ontrack = (event) => {
          element.srcObject = event.streams[0] ?? null;
          void element.play().catch(() => {
            /* ilk oynatma engellenirse sonraki ses parçasında tekrar denenir */
          });
        };

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        const channel = pc.createDataChannel("oai-events");
        channelRef.current = channel;

        const machine = new RealtimeTurnMachine({
          mintSecret: async () => ({
            token: secret.token,
            model: secret.model,
            callUrl: secret.callUrl,
          }),
          send: (payload) => {
            if (channel.readyState === "open") channel.send(JSON.stringify(payload));
          },
          stopPlayback: () => {
            // Araya girme: çalan ses DERHAL susar, kalan parçalar atılır.
            element.pause();
            // Canlı WebRTC akışında duration = Infinity; currentTime'a sonsuz
            // yazmak "Failed to set the 'currentTime' property" atıyordu
            // (canlı hata kaydı). Canlı akış play()'de zaten canlı noktadan
            // sürer; atlama yalnız sonlu süreli kayıtta gerekir.
            if (Number.isFinite(element.duration)) element.currentTime = element.duration;
          },
          answerQuestion: (question) => cbRef.current.answerQuestion(question),
          onPhase: (next) => {
            if (!liveRef.current) return;
            setPhase(next);
            if (next === "konusuyor") {
              void element.play().catch(() => {
                /* yönlendirme değişmiş olabilir */
              });
            }
          },
          onUserText: (text) => cbRef.current.onUserText(text),
          onAssistantText: (text) => cbRef.current.onAssistantText(text),
          onError: (message) => cbRef.current.onError(message),
          onLatency: (_marks: TurnMarks, value) => setLatency(value),
          now: () => (typeof performance === "undefined" ? Date.now() : performance.now()),
          ...(debug ? { log: (line: string) => console.info(line) } : {}),
          voice,
          instructions: INSTRUCTIONS,
        });
        machineRef.current = machine;

        channel.addEventListener("open", () => machine.configure(secret.model));
        channel.addEventListener("message", (event) => {
          try {
            void machine.handle(JSON.parse(String(event.data)) as { type?: string });
          } catch {
            /* ayrıştırılamayan olay yoksayılır */
          }
        });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        const answer = await fetch(`${secret.callUrl}?model=${encodeURIComponent(secret.model)}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${secret.token}`,
            "Content-Type": "application/sdp",
          },
          body: offer.sdp ?? "",
        });
        if (!answer.ok) {
          const body = await answer.text().catch(() => "");
          throw new Error(
            `Gerçek zamanlı bağlantı kurulamadı (durum ${answer.status})${
              body ? `: ${body.slice(0, 140)}` : "."
            }`,
          );
        }
        await pc.setRemoteDescription({ type: "answer", sdp: await answer.text() });
      } catch (error) {
        if (!liveRef.current) return;
        teardown();
        cbRef.current.onUnavailable(
          error instanceof Error ? error.message : "Gerçek zamanlı ses başlatılamadı.",
        );
      }
    })();

    return teardown;
    // Oturum bir kez kurulur; ses tercihi değişirse ekran yeniden açılır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Uygulama arka plana geçerse mikrofon susturulur.
  useEffect(() => {
    const onVisibility = () => {
      const hidden = document.visibilityState === "hidden";
      streamRef.current?.getAudioTracks().forEach((track) => {
        track.enabled = !hidden;
      });
      if (hidden) machineRef.current?.interrupt();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return {
    phase,
    latency,
    close: teardown,
    interrupt: () => machineRef.current?.interrupt(),
  };
}
