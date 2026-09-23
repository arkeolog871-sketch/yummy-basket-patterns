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
import { listAddresses } from "@/lib/addresses.functions";
import { createOrder } from "@/lib/orders.functions";
import { shouldSpeakReply } from "@/lib/assistant-speech";
import {
  buildOrderConfirmationSpeech,
  parseVoiceConfirmation,
} from "@/lib/voice-order-confirmation";
import { VoiceConversation } from "./VoiceConversation";
import capedS from "@/assets/pelerinli-s.png";
import {
  collectMicrophoneDiagnostics,
  formatMicrophoneDiagnostics,
  microphoneAdvice,
} from "@/lib/microphone-diagnostics";
import {
  MicrophoneSession,
  type AudioStreamLike,
  type RecorderLike,
} from "@/lib/microphone-session";
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
import {
  ASSISTANT_VOICES,
  DEFAULT_ASSISTANT_VOICE,
  normalizeAssistantVoice,
} from "@/lib/assistant-voices";

const STORAGE_KEY = "silvan.assistant.v1";
const INSTRUCTION_KEY = "silvan.assistant.instruction.v1";
const VOICE_KEY = "silvan.assistant.voice.v1";
const VOICE_NAME_KEY = "silvan.assistant.voiceName.v1";
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
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceName, setVoiceName] = useState(DEFAULT_ASSISTANT_VOICE);
  const [showSettings, setShowSettings] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [instructionDraft, setInstructionDraft] = useState("");

  const ask = useServerFn(askOrderAssistant);
  const loadHistory = useServerFn(listAssistantHistory);
  const saveHistory = useServerFn(appendAssistantHistory);
  const wipeHistory = useServerFn(clearAssistantHistory);
  const transcribe = useServerFn(transcribeAssistantAudio);
  const fetchAddresses = useServerFn(listAddresses);
  const submitOrder = useServerFn(createOrder);
  const speak = useServerFn(speakAssistantReply);
  const cart = useCart();
  const navigate = useNavigate();
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const micRef = useRef<MicrophoneSession | null>(null);
  // Sesli onay bekleyen sepet önerisi. Doluysa bir sonraki söz onay sayılır.
  const pendingOrderRef = useRef<CartProposal | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordedTypeRef = useRef<string>("audio/webm");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const spokenGreetingRef = useRef<string | null>(null);
  const historyLoadedRef = useRef(false);

  const firstName = useMemo(() => {
    const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
    const raw = meta["full_name"] ?? meta["name"] ?? meta["display_name"];
    if (typeof raw !== "string") return null;
    const first = raw.trim().split(/\s+/)[0];
    return first ? first.slice(0, 30) : null;
  }, [user]);

  // Bileşen sökülürken mikrofon MUTLAKA bırakılır. Kayıt sürerken kullanıcı
  // başka sayfaya geçerse recorder.onstop hiç çalışmaz; akış açık kalır ve
  // mikrofonu sayfanın kendisi tutmaya devam eder. Bir sonraki denemede
  // tarayıcı NotReadableError atar, kullanıcı da "başka bir uygulama
  // kullanıyor olabilir" mesajını görür — oysa tutan biziz.
  useEffect(() => {
    return () => {
      micRef.current?.release();
      micRef.current = null;
    };
  }, []);

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
      setVoiceName(normalizeAssistantVoice(window.localStorage.getItem(VOICE_NAME_KEY)));
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
    // voiceOverride: ses seçilir seçilmez örnek dinletilirken durum değişkeni
    // henüz güncellenmemiş oluyor; yeni ses doğrudan verilir.
    async (text: string, voiceOverride?: string) => {
      try {
        const audio = await speak({
          data: { text: text.slice(0, 900), voice: voiceOverride ?? voiceName },
        });
        const element = audioRef.current ?? new Audio();
        audioRef.current = element;
        // Mobil WebView'lerde uzun `data:` sesleri kimi zaman hiç açılmıyor;
        // blob adresi iOS ve Android'de güvenilir çalışıyor.
        const binary = atob(audio.base64);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
          bytes[index] = binary.charCodeAt(index);
        }
        const url = URL.createObjectURL(new Blob([bytes], { type: audio.contentType }));
        const previous = objectUrlRef.current;
        objectUrlRef.current = url;
        if (previous) URL.revokeObjectURL(previous);
        element.src = url;
        // Sesli sohbette bu bekleme şart: play() sesin BAŞLADIĞINDA çözülüyor.
        // Bitişi beklemezsek mikrofon asistan hâlâ konuşurken açılır ve
        // asistan kendi sesini duyup kendine cevap verir.
        const finished = new Promise<void>((resolve) => {
          const done = () => {
            element.removeEventListener("ended", done);
            element.removeEventListener("error", done);
            resolve();
          };
          element.addEventListener("ended", done);
          element.addEventListener("error", done);
        });
        await element.play();
        await finished;
        return { ok: true as const };
      } catch (error) {
        // Sessizce yutma. Sesli sohbette konuşmama, kullanıcı için özelliğin
        // hiç çalışmaması demek; sebebi görünmezse aramak da imkânsız.
        // Yazılı yanıt ekranda kalmaya devam ediyor.
        const name = (error as { name?: string } | null)?.name ?? "";
        return { ok: false as const, reason: toPublicErrorMessage(error) || name || "bilinmiyor" };
      }
    },
    [speak, voiceName],
  );

  const sendText = useCallback(
    async (text: string, options?: { spoken?: boolean; deferSpeech?: boolean }) => {
      // spoken: bu tur mikrofonla başladı. Sesle konuşulduysa sesle cevap
      // verilir; "Sesli yanıt" anahtarı yalnızca yazarak konuşanlar için.
      const spoken = options?.spoken === true;
      const clean = text.trim();
      if (!clean || busy) return null;
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
        // Sesli sohbet ekranı seslendirmeyi kendi yönetiyor: sırayla
        // konuşup bitmesini bekliyor, sonra mikrofonu açıyor.
        if (options?.deferSpeech) return { reply: response.reply, proposal: answer.proposal };
        if (shouldSpeakReply({ voiceOn, spoken, reply: response.reply })) {
          void playReply(response.reply).then((outcome) => {
            if (!outcome.ok) {
              toast.error("Sesli yanıt oynatılamadı, cevabı yazılı olarak gönderdim.", {
                description: outcome.reason,
                duration: 8000,
              });
            }
          });
        }
        return { reply: response.reply, proposal: answer.proposal };
      } catch (error) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Şu an yanıt veremiyorum. ${toPublicErrorMessage(error)}`,
          },
        ]);
        return null;
      } finally {
        setBusy(false);
      }
    },
    [ask, busy, instruction, messages, persist, playReply, voiceOn],
  );

  async function startRecording() {
    if (recording || busy || transcribing) return;
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      // Çok eski iOS sürümlerinde ses kaydı yok; kullanıcı yazarak devam etsin.
      toast.error("Bu cihazda ses kaydı desteklenmiyor. Mesajınızı yazabilirsiniz.");
      return;
    }
    // DİKKAT: burada izin durumu ÖNCEDEN sorgulanmaz. Android WebView ve bazı
    // mobil tarayıcılar mikrofon iznini henüz sorulmamışken de "denied"
    // bildiriyor; ön kontrol yüzünden izin ekranı hiç açılmıyor ve sesli
    // konuşma mobilde hiç başlamıyordu. Doğru yol doğrudan izin istemek: izin
    // ekranını sistem gösterir, sonuç olumsuzsa aşağıdaki mesajlar devreye girer.
    try {
      // İlk kullanımda tarayıcı tek seferlik izin sorar; izin verilince kayıt başlar.
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
            recordedTypeRef.current = recorder.mimeType || mimeType || "audio/webm";
            return recorder as unknown as RecorderLike;
          },
          // "Meşgul" hatası bazen gerçekten geçici oluyor (az önce kapanan
          // bir ses oynatması, bırakılmakta olan başka bir uygulama). Tek
          // yeniden deneme; kalıcı engelde maliyeti yarım saniye.
          sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        });
      micRef.current = session;
      chunksRef.current = [];
      await session.start(
        (chunk) => chunksRef.current.push(chunk as Blob),
        () => {
          const blob = new Blob(chunksRef.current, {
            type: recordedTypeRef.current || "audio/webm",
          });
          chunksRef.current = [];
          setRecording(false);
          void handleRecorded(blob);
        },
      );
      setRecording(true);
    } catch (error) {
      // Mesajı tahminle değil ÖLÇÜMLE seç. "Mikrofona ulaşılamadı" aynı anda
      // dört ayrı durumu anlatıyordu ve çözümleri farklı; tanı satırı
      // ekran görüntüsünden teşhis edilebilsin diye mesajın altına yazılıyor.
      setRecording(false);
      const diagnostics = await collectMicrophoneDiagnostics(error, {
        userAgent: typeof navigator === "undefined" ? "" : navigator.userAgent,
        secureContext: typeof window !== "undefined" && window.isSecureContext,
        listDevices: () => navigator.mediaDevices.enumerateDevices(),
        // Android sarmalayıcının Java tarafı ölçümü; köprüsü olmayan eski
        // uygulama sürümlerinde bu alan yok ve tanı onsuz da dönüyor.
        nativeProbe: () =>
          (
            window as unknown as { SilvanNative?: { micDiagnostics?: () => string } }
          ).SilvanNative?.micDiagnostics?.(),
        // permissions.query BİLEREK kullanılmıyor: Android WebView mikrofon
        // iznini daha hiç sorulmamışken "denied" bildiriyor ve ön kontrol
        // izin penceresini hiç açtırmıyordu. Bu dosyada o çağrının
        // bulunmaması assistant-voice-mobile testiyle korunuyor; izin
        // durumu zaten hatanın adından okunuyor.
      });
      toast.error(microphoneAdvice(diagnostics), {
        description: formatMicrophoneDiagnostics(diagnostics),
        duration: 9000,
      });
    }
  }

  function stopRecording() {
    setRecording(false);
    micRef.current?.stop();
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
      // Sesle başlayan sohbet sesle sürsün: tercih de açılıyor ki sonraki
      // turlarda kullanıcı anahtarı aramak zorunda kalmasın.
      enableVoiceReplies();
      await sendText(result.text, { spoken: true });
    } catch (error) {
      toast.error(toPublicErrorMessage(error));
    } finally {
      setTranscribing(false);
    }
  }

  /**
   * Sesli sohbetin bir turu. Bekleyen bir sipariş onayı varsa önce ona bakar:
   * sipariş oluşturma kararı yapay zekânın niyet tahminine değil, okunabilir
   * bir kurala (parseVoiceConfirmation) bağlı.
   */
  async function voiceAsk(said: string): Promise<string> {
    const pending = pendingOrderRef.current;
    if (pending) {
      const verdict = parseVoiceConfirmation(said);
      if (verdict === "evet") {
        pendingOrderRef.current = null;
        return placeVoiceOrder(pending);
      }
      // "hayır" da "belirsiz" de siparişi oluşturmaz; şüphe varsa sohbet sürer.
      pendingOrderRef.current = null;
      if (verdict === "hayir") {
        const message = "Tamam, siparişi oluşturmadım. Başka nasıl yardımcı olabilirim?";
        setMessages((prev) => [...prev, { role: "assistant", content: message }]);
        return message;
      }
    }

    const result = await sendText(said, { spoken: true, deferSpeech: true });
    if (!result) return "";
    if (!result.proposal) return result.reply;

    // Öneri geldi: onay cümlesini kurabilmek için adres gerekiyor.
    if (!user) {
      return `${result.reply} Siparişi sesle tamamlayabilmem için önce giriş yapmanız gerekiyor.`;
    }
    try {
      const addresses = await fetchAddresses();
      const address = addresses[0];
      if (!address) {
        return `${result.reply} Kayıtlı teslimat adresiniz yok; hesabım sayfasından bir adres ekleyin, sonra siparişi sesle tamamlayabiliriz.`;
      }
      pendingOrderRef.current = result.proposal;
      const confirmation = buildOrderConfirmationSpeech(result.proposal, {
        recipient_name: address.recipient_name,
        district: address.district,
        city: address.city,
      });
      setMessages((prev) => [...prev, { role: "assistant", content: confirmation }]);
      return `${result.reply} ${confirmation}`;
    } catch (error) {
      return `${result.reply} Adres bilgisine ulaşamadım. ${toPublicErrorMessage(error)}`;
    }
  }

  /** Onaylanan öneriyi gerçek siparişe çevirir. */
  async function placeVoiceOrder(proposal: CartProposal): Promise<string> {
    let message: string;
    try {
      const addresses = await fetchAddresses();
      const address = addresses[0];
      if (!address) {
        message = "Teslimat adresi bulamadım, siparişi oluşturamadım.";
      } else {
        const result = await submitOrder({
          data: {
            restaurant_id: proposal.restaurant.id,
            items: proposal.lines.map((line) => ({
              menu_item_id: line.menuItemId,
              quantity: line.quantity,
            })),
            recipient_name: address.recipient_name,
            phone: address.phone,
            city: address.city,
            district: address.district,
            street: address.street,
            idempotency_key:
              typeof crypto !== "undefined" && "randomUUID" in crypto
                ? crypto.randomUUID()
                : undefined,
          },
        });
        message = result.ok
          ? `Siparişiniz alındı. ${proposal.restaurant.name} hazırlamaya başlıyor, kapıda ödeyeceksiniz. Siparişlerim sayfasından takip edebilirsiniz.`
          : `Siparişi oluşturamadım. ${result.error}`;
      }
    } catch (error) {
      message = `Siparişi oluşturamadım. ${toPublicErrorMessage(error)}`;
    }
    setMessages((prev) => [...prev, { role: "assistant", content: message }]);
    return message;
  }

  function enableVoiceReplies() {
    if (voiceOn) return;
    setVoiceOn(true);
    try {
      window.localStorage.setItem(VOICE_KEY, "1");
    } catch {
      /* depolama kapalıysa yalnızca bu oturumda geçerli */
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

  if (voiceMode) {
    return (
      <VoiceConversation
        voice={voiceName}
        transcript={messages}
        onClose={() => setVoiceMode(false)}
        onError={(message, detail) =>
          toast.error(message, detail ? { description: detail, duration: 9000 } : undefined)
        }
        transcribe={async (blob) => {
          const base64 = await blobToBase64(blob);
          const mimeType = (blob.type || "audio/webm").split(";")[0] ?? "audio/webm";
          const result = await transcribe({ data: { audio: base64, mimeType } });
          return result.text;
        }}
        ask={voiceAsk}
        speak={async (reply) => {
          const outcome = await playReply(reply);
          if (!outcome.ok) {
            toast.error("Sesli yanıt oynatılamadı, cevabı yazılı olarak gönderdim.", {
              description: outcome.reason,
              duration: 8000,
            });
          }
        }}
      />
    );
  }

  return (
    <>
      {open ? null : (
        <>
          <button
            type="button"
            onClick={() => {
              enableVoiceReplies();
              setVoiceMode(true);
            }}
            aria-label="Sesli sohbeti başlat"
            className={`fixed bottom-36 right-5 z-40 flex size-12 items-center justify-center overflow-hidden rounded-full shadow-lg transition-transform hover:scale-105 sm:bottom-24 ${
              recording ? "bg-destructive text-destructive-foreground" : "bg-black"
            }`}
          >
            {recording ? (
              <Square className="size-5" />
            ) : transcribing ? (
              <Loader2 className="size-5 animate-spin text-white" />
            ) : (
              // Mikrofon simgesi yerine uygulamanın pelerinli "S" amblemi.
              <img
                src={capedS}
                alt=""
                width={1024}
                height={1024}
                loading="lazy"
                className="size-9 object-contain"
              />
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
            <div className="space-y-3 border-b border-border bg-muted/40 px-4 py-3">
              <div className="space-y-1">
                <label htmlFor="asistan-sesi" className="text-xs font-medium text-muted-foreground">
                  Asistanın sesi
                </label>
                <select
                  id="asistan-sesi"
                  value={voiceName}
                  onChange={(event) => {
                    const next = normalizeAssistantVoice(event.target.value);
                    setVoiceName(next);
                    try {
                      window.localStorage.setItem(VOICE_NAME_KEY, next);
                    } catch {
                      /* depolama kapalıysa tercih yalnız bu oturumda geçerli */
                    }
                    void playReply("Merhaba, sesim böyle. Nasıl yardımcı olabilirim?", next);
                  }}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                >
                  {ASSISTANT_VOICES.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.label} — {voice.hint}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground">
                  Seçtiğinizde kısa bir örnek dinletir; tercihiniz bu cihazda saklanır.
                </p>
              </div>
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
