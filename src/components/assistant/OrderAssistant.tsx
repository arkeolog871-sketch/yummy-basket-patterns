/**
 * Silvan Cebimde yapay zekâ asistanı — sağ altta duran yardımcı.
 *
 * Yazılı ve SESLİ sohbet eder: mikrofon kaydı sunucuda metne çevrilir, asistanın
 * yanıtı istenirse sesli okunur. Kullanıcı ayrıca kalıcı bir talimat yazabilir
 * (örn. "kısa konuş", "bana sen diye hitap et").
 *
 * Asistan sipariş OLUŞTURMAZ: en fazla sepet önerisi hazırlar, kullanıcı
 * "Sepete ekle"ye basınca ürünler mevcut sepete girer ve sipariş her zaman
 * ödeme sayfasındaki "Siparişi onayla" adımında kullanıcının onayıyla oluşur.
 * Sohbet ve talimat yalnızca cihazda saklanır.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Loader2,
  MessageCircle,
  Mic,
  Send,
  Settings2,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { formatPrice } from "@/lib/format";
import { toPublicErrorMessage } from "@/lib/public-error";
import { askOrderAssistant } from "@/lib/ai-assistant.functions";
import { speakAssistantReply, transcribeAssistantAudio } from "@/lib/ai-voice.functions";
import {
  appendAssistantHistory,
  clearAssistantHistory,
  listAssistantHistory,
} from "@/lib/assistant-history.functions";
import type { CartProposal } from "@/lib/ai-assistant.types";

const STORAGE_KEY = "silvan.assistant.v1";
const INSTRUCTION_KEY = "silvan.assistant.instruction.v1";
const VOICE_KEY = "silvan.assistant.voice.v1";
const MAX_HISTORY = 18;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  proposal?: CartProposal | null;
};

function buildGreeting(firstName: string | null): ChatMessage {
  const hello = firstName ? `Hoş geldin ${firstName}!` : "Hoş geldiniz!";
  return {
    role: "assistant",
    content: `${hello} Nasıl yardımcı olabilirim? Yazabilir ya da mikrofona basıp konuşabilirsiniz. Silvan hakkında sohbet edebilir, bilgi alabilir; uygulamadaki işletmelerden sipariş için sepet önerisi hazırlayabilirim. Siparişi her zaman siz onaylarsınız.`,
  };
}

const GREETING: ChatMessage = buildGreeting(null);

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Ses kaydı okunamadı."));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? (result.split(",")[1] ?? "") : result);
    };
    reader.readAsDataURL(blob);
  });
}

export function OrderAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [instructionDraft, setInstructionDraft] = useState("");

  const ask = useServerFn(askOrderAssistant);
  const loadHistory = useServerFn(listAssistantHistory);
  const saveHistory = useServerFn(appendAssistantHistory);
  const wipeHistory = useServerFn(clearAssistantHistory);
  const transcribe = useServerFn(transcribeAssistantAudio);
  const speak = useServerFn(speakAssistantReply);
  const cart = useCart();
  const navigate = useNavigate();
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const spokenGreetingRef = useRef<string | null>(null);
  const historyLoadedRef = useRef(false);

  const firstName = useMemo(() => {
    const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
    const raw = meta["full_name"] ?? meta["name"] ?? meta["display_name"];
    if (typeof raw !== "string") return null;
    const first = raw.trim().split(/\s+/)[0];
    return first ? first.slice(0, 30) : null;
  }, [user]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ChatMessage[];
        if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed);
      }
      const savedInstruction = window.localStorage.getItem(INSTRUCTION_KEY) ?? "";
      setInstruction(savedInstruction);
      setInstructionDraft(savedInstruction);
      setVoiceOn(window.localStorage.getItem(VOICE_KEY) === "1");
    } catch {
      /* bozuk sohbet kaydı yok sayılır */
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_HISTORY)));
    } catch {
      /* depolama kapalıysa sohbet yalnızca bu oturumda kalır */
    }
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages, open, busy, transcribing]);

  // Kullanıcı adı gelince henüz konuşulmamış karşılamayı kişiselleştir.
  useEffect(() => {
    if (!firstName) return;
    setMessages((prev) =>
      prev.length === 1 && prev[0]?.content === GREETING.content
        ? [buildGreeting(firstName)]
        : prev,
    );
  }, [firstName]);

  // Sohbet açılınca karşılama sesli okunur (açma dokunuşu kullanıcı hareketi sayılır).
  useEffect(() => {
    if (!open || !voiceOn) return;
    const first = messages[0];
    if (!first || first.role !== "assistant" || messages.length !== 1) return;
    if (spokenGreetingRef.current === first.content) return;
    spokenGreetingRef.current = first.content;
    void playReply(first.content);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, voiceOn, messages]);

  // Giriş yapmış kullanıcının sohbeti veritabanından yüklenir (sayfa yenilenince kaybolmaz).
  useEffect(() => {
    if (!user?.id || historyLoadedRef.current) return;
    historyLoadedRef.current = true;
    void (async () => {
      try {
        const rows = await loadHistory();
        if (!Array.isArray(rows) || rows.length === 0) return;
        setMessages(
          rows.map((row) => ({
            role: row.role === "user" ? "user" : "assistant",
            content: row.content,
            proposal: (row.proposal ?? null) as CartProposal | null,
          })),
        );
      } catch {
        /* geçmiş alınamazsa cihazdaki sohbet gösterilmeye devam eder */
      }
    })();
  }, [loadHistory, user?.id]);

  const persist = useCallback(
    async (rows: ChatMessage[]) => {
      if (!user?.id || rows.length === 0) return;
      try {
        await saveHistory({
          data: {
            messages: rows.slice(0, 4).map((row) => ({
              role: row.role,
              content: row.content.slice(0, 4000),
              proposal: row.proposal ?? null,
            })),
          },
        });
      } catch {
        /* kaydedilemezse sohbet ekranda ve cihazda kalır */
      }
    },
    [saveHistory, user?.id],
  );

  const playReply = useCallback(
    async (text: string) => {
      try {
        const audio = await speak({ data: { text: text.slice(0, 900) } });
        const element = audioRef.current ?? new Audio();
        audioRef.current = element;
        element.src = `data:${audio.contentType};base64,${audio.base64}`;
        await element.play();
      } catch {
        /* sesli okuma başarısız olsa da yazılı yanıt ekranda duruyor */
      }
    },
    [speak],
  );

  const sendText = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean || busy) return;
      const next: ChatMessage[] = [...messages, { role: "user", content: clean }];
      setMessages(next);
      setDraft("");
      setBusy(true);
      try {
        const response = await ask({
          data: {
            messages: next
              .slice(-MAX_HISTORY)
              .map((message) => ({ role: message.role, content: message.content })),
            instruction: instruction.trim() ? instruction.trim().slice(0, 600) : null,
          },
        });
        const answer: ChatMessage = {
          role: "assistant",
          content: response.reply,
          proposal: response.proposal ?? null,
        };
        setMessages((prev) => [...prev, answer]);
        void persist([{ role: "user", content: clean }, answer]);
        if (voiceOn && response.reply) void playReply(response.reply);
      } catch (error) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Şu an yanıt veremiyorum. ${toPublicErrorMessage(error)}`,
          },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [ask, busy, instruction, messages, persist, playReply, voiceOn],
  );

  async function startRecording() {
    if (recording || busy || transcribing) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      toast.error("Bu cihazda mikrofon kaydı desteklenmiyor.");
      return;
    }
    // İzin daha önce reddedildiyse tarayıcı artık sormaz; kullanıcıyı yönlendir.
    try {
      const permissionApi = (
        navigator as Navigator & { permissions?: { query: (d: { name: string }) => Promise<{ state: string }> } }
      ).permissions;
      if (permissionApi) {
        const status = await permissionApi.query({ name: "microphone" });
        if (status.state === "denied") {
          toast.error(
            "Mikrofon izni kapalı. Tarayıcı ayarlarından bu site için mikrofona izin verin.",
            { duration: 6000 },
          );
          return;
        }
      }
    } catch {
      /* Permissions API yoksa doğrudan izin istemeye geç */
    }
    try {
      // İlk kullanımda tarayıcı tek seferlik izin sorar; izin verilince kayıt başlar.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ["audio/webm", "audio/mp4", "audio/ogg"].find((type) =>
        typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type),
      );
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        chunksRef.current = [];
        void handleRecorded(blob);
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      toast.error("Mikrofon izni verilmedi.");
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    setRecording(false);
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }

  async function handleRecorded(blob: Blob) {
    if (blob.size < 1200) {
      toast.error("Kayıt çok kısa, tekrar deneyin.");
      return;
    }
    setTranscribing(true);
    try {
      const base64 = await blobToBase64(blob);
      const mimeType = (blob.type || "audio/webm").split(";")[0] ?? "audio/webm";
      const result = await transcribe({ data: { audio: base64, mimeType } });
      await sendText(result.text);
    } catch (error) {
      toast.error(toPublicErrorMessage(error));
    } finally {
      setTranscribing(false);
    }
  }

  function toggleVoice() {
    const next = !voiceOn;
    setVoiceOn(next);
    try {
      window.localStorage.setItem(VOICE_KEY, next ? "1" : "0");
    } catch {
      /* depolama kapalıysa yalnızca bu oturumda geçerli */
    }
    if (!next && audioRef.current) audioRef.current.pause();
  }

  function saveInstruction() {
    const clean = instructionDraft.trim().slice(0, 600);
    setInstruction(clean);
    try {
      window.localStorage.setItem(INSTRUCTION_KEY, clean);
    } catch {
      /* depolama kapalıysa yalnızca bu oturumda geçerli */
    }
    setShowSettings(false);
    toast.success(clean ? "Talimatınız kaydedildi" : "Talimat kaldırıldı");
  }

  function addProposalToCart(proposal: CartProposal) {
    for (const line of proposal.lines) {
      cart.addItem(
        proposal.restaurant,
        {
          menuItemId: line.menuItemId,
          name: line.name,
          price: line.price,
          imageUrl: line.imageUrl,
        },
        line.quantity,
      );
    }
    toast.success("Ürünler sepete eklendi");
    setOpen(false);
    void navigate({ to: "/sepet" });
  }

  return (
    <>
      {open ? null : (
        <>
          <button
            type="button"
            onClick={() => (recording ? stopRecording() : void startRecording())}
            disabled={busy || transcribing}
            aria-label={recording ? "Kaydı bitir ve gönder" : "Sesli konuş"}
            className={`fixed bottom-36 right-5 z-40 flex size-12 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 sm:bottom-24 ${
              recording
                ? "bg-destructive text-destructive-foreground"
                : "bg-card text-primary border border-border"
            }`}
          >
            {recording ? (
              <Square className="size-5" />
            ) : transcribing ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Mic className="size-5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Yapay zekâ asistanını aç"
            className="fixed bottom-20 right-4 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 sm:bottom-6"
          >
            <MessageCircle className="size-6" />
          </button>
        </>
      )}

      {open ? (
        <div className="fixed inset-x-2 bottom-2 z-50 flex max-h-[80vh] flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-xl sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-[24rem]">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <Sparkles className="size-4 shrink-0 text-primary" />
              <p className="min-w-0 truncate font-semibold">Silvan asistanı</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleVoice}
                aria-label={voiceOn ? "Sesli yanıtı kapat" : "Sesli yanıtı aç"}
                title={voiceOn ? "Sesli yanıt açık" : "Sesli yanıt kapalı"}
                className="rounded-full p-2 hover:bg-muted"
              >
                {voiceOn ? (
                  <Volume2 className="size-4 text-primary" />
                ) : (
                  <VolumeX className="size-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowSettings((prev) => !prev)}
                aria-label="Asistan talimatı"
                className="rounded-full p-2 hover:bg-muted"
              >
                <Settings2 className={showSettings ? "size-4 text-primary" : "size-4"} />
              </button>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full text-xs"
                onClick={() => {
                  spokenGreetingRef.current = null;
                  setMessages([buildGreeting(firstName)]);
                  if (user?.id) void wipeHistory();
                }}
              >
                Yeni sohbet
              </Button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Asistanı kapat"
                className="rounded-full p-2 hover:bg-muted"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {showSettings ? (
            <div className="space-y-2 border-b border-border bg-muted/40 px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Asistana kalıcı talimat verin. Örn. “Bana kısa ve samimi cevap ver, fiyatları her
                zaman belirt.”
              </p>
              <Textarea
                value={instructionDraft}
                onChange={(event) => setInstructionDraft(event.target.value)}
                maxLength={600}
                rows={3}
                placeholder="Asistan nasıl davransın?"
                aria-label="Asistan talimatı"
              />
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-muted-foreground">
                  {instructionDraft.trim().length}/600
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full"
                    onClick={() => setInstructionDraft("")}
                  >
                    Temizle
                  </Button>
                  <Button size="sm" className="rounded-full" onClick={saveInstruction}>
                    Kaydet
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((message, index) => (
              <div key={index} className="space-y-2">
                <div
                  className={
                    message.role === "user"
                      ? "ml-auto max-w-[85%] rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground [overflow-wrap:anywhere]"
                      : "max-w-[90%] rounded-2xl bg-muted px-3 py-2 text-sm [overflow-wrap:anywhere] whitespace-pre-wrap"
                  }
                >
                  {message.content}
                </div>
                {message.role === "assistant" && message.content ? (
                  <button
                    type="button"
                    onClick={() => void playReply(message.content)}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    <Volume2 className="size-3" /> Sesli dinle
                  </button>
                ) : null}
                {message.proposal ? (
                  <ProposalCard
                    proposal={message.proposal}
                    onAdd={() => addProposalToCart(message.proposal as CartProposal)}
                  />
                ) : null}
              </div>
            ))}
            {transcribing ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Ses yazıya çevriliyor…
              </div>
            ) : null}
            {busy ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Yazıyor…
              </div>
            ) : null}
          </div>

          <div className="border-t border-border px-3 pb-3 pt-2">
            <Button
              type="button"
              variant={recording ? "destructive" : "secondary"}
              className="mb-2 w-full rounded-full"
              onClick={() => (recording ? stopRecording() : void startRecording())}
              disabled={busy || transcribing}
              aria-label={recording ? "Kaydı bitir ve gönder" : "Sesli konuş"}
            >
              {recording ? (
                <>
                  <Square className="size-4" /> Dinliyorum… bitirmek için dokunun
                </>
              ) : (
                <>
                  <Mic className="size-4" /> Sesli konuş
                </>
              )}
            </Button>
            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void sendText(draft);
              }}
            >
              <Input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={
                  recording ? "Dinliyorum… bitirmek için üstteki tuşa basın" : "Mesajınızı yazın"
                }
                aria-label="Asistana mesaj yazın"
                className="rounded-full"
                disabled={busy || recording || transcribing}
              />
              <Button
                type="submit"
                size="icon"
                className="shrink-0 rounded-full"
                disabled={busy || recording || transcribing || draft.trim().length === 0}
                aria-label="Gönder"
              >
                <Send className="size-4" />
              </Button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ProposalCard({ proposal, onAdd }: { proposal: CartProposal; onAdd: () => void }) {
  const belowMinimum = proposal.subtotal < proposal.restaurant.minOrder;
  return (
    <div className="rounded-2xl border border-border bg-background p-3 text-sm">
      <p className="font-semibold [overflow-wrap:anywhere]">{proposal.restaurant.name}</p>
      <ul className="mt-2 space-y-1">
        {proposal.lines.map((line) => (
          <li key={line.menuItemId} className="flex items-start justify-between gap-2">
            <span className="min-w-0 [overflow-wrap:anywhere]">
              {line.quantity} × {line.name}
            </span>
            <span className="whitespace-nowrap">{formatPrice(line.price * line.quantity)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        Ara toplam {formatPrice(proposal.subtotal)} · Teslimat{" "}
        {formatPrice(proposal.restaurant.deliveryFee)}
        {proposal.restaurant.minOrder > 0
          ? ` · Minimum sepet ${formatPrice(proposal.restaurant.minOrder)}`
          : ""}
      </p>
      {belowMinimum ? (
        <p className="mt-1 text-xs text-destructive">
          Minimum sepet tutarının altında; sepete ekleyip ürün ekleyebilirsiniz.
        </p>
      ) : null}
      <Button className="mt-3 w-full rounded-full" onClick={onAdd}>
        Sepete ekle
      </Button>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Sipariş oluşmaz; ödeme sayfasında siz onaylayana kadar hiçbir şey kesinleşmez.
      </p>
    </div>
  );
}
