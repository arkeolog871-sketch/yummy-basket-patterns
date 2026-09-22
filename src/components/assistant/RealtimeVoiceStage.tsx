/**
 * Gerçek zamanlı sesli sohbet sahnesi.
 *
 * Ekran görüntüsü klasik sahneyle aynı: siyah zemin, ortada pelerinli amblem.
 * Fark davranışta: mikrofon sürekli açık, tur bitişini sunucu algılıyor, yanıt
 * sesi üretilirken çalıyor ve kullanıcı araya girdiğinde ses anında kesiliyor.
 */
import { Loader2, X } from "lucide-react";
import capedS from "@/assets/pelerinli-s.png";
import { CapeEmblem } from "./CapeEmblem";
import { useRealtimeVoice } from "./useRealtimeVoice";
import type { RealtimePhase } from "@/lib/realtime-voice";

const PHASE_LABEL: Record<RealtimePhase, string> = {
  baglaniyor: "Bağlanıyor…",
  dinliyor: "Dinliyorum, konuşun",
  "kullanici-konusuyor": "Sizi duyuyorum",
  dusunuyor: "Düşünüyorum…",
  konusuyor: "Konuşuyorum (sözümü kesebilirsiniz)",
};

export interface RealtimeVoiceStageProps {
  voice: string;
  /** Uygulamanın kendi asistanına soru sorar (veritabanı araçlarıyla). */
  answerQuestion: (question: string) => Promise<string>;
  onUserText: (text: string) => void;
  onAssistantText: (text: string) => void;
  onUnavailable: (reason: string) => void;
  onClose: () => void;
  transcript: { role: "user" | "assistant"; content: string }[];
}

export function RealtimeVoiceStage({
  voice,
  answerQuestion,
  onUserText,
  onAssistantText,
  onUnavailable,
  onClose,
  transcript,
}: RealtimeVoiceStageProps) {
  const { phase, latency, close, interrupt } = useRealtimeVoice({
    voice,
    answerQuestion,
    onUserText,
    onAssistantText,
    onUnavailable,
    onError: (reason) => console.warn("[REALTIME]", reason),
  });

  const lastUser = [...transcript].reverse().find((m) => m.role === "user");
  const lastAssistant = [...transcript].reverse().find((m) => m.role === "assistant");

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-white">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="font-semibold">Sesli sohbet</p>
        <button
          type="button"
          onClick={() => {
            close();
            onClose();
          }}
          aria-label="Sesli sohbeti kapat"
          className="flex size-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        <div aria-hidden className="relative flex size-64 items-center justify-center">
          <span
            className={`absolute inset-6 rounded-full blur-2xl ${
              phase === "kullanici-konusuyor" ? "bg-red-500/25" : "bg-white/5"
            }`}
          />
          <CapeEmblem
            src={capedS}
            paused={phase === "baglaniyor"}
            scale={phase === "kullanici-konusuyor" ? 11 : 7}
            className={`relative w-56 drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)] ${
              phase === "baglaniyor" ? "opacity-70" : ""
            }`}
          />
          {phase === "dusunuyor" || phase === "baglaniyor" ? (
            <Loader2 className="absolute bottom-0 size-6 animate-spin text-white/80" />
          ) : null}
        </div>

        <p aria-live="polite" className="text-lg font-medium">
          {PHASE_LABEL[phase]}
        </p>

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

        {latency?.speechEndToFirstAudio != null ? (
          <p className="text-xs text-white/40">
            Yanıt gecikmesi: {latency.speechEndToFirstAudio} ms
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-center gap-6 px-6 pb-8 text-center">
        {phase === "konusuyor" ? (
          <button type="button" onClick={interrupt} className="text-sm text-white/70 underline">
            Sustur
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            close();
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
