/**
 * Sipariş asistanı sohbeti — sağ altta duran yardımcı.
 *
 * Asistan sipariş OLUŞTURMAZ: en fazla sepet önerisi hazırlar, kullanıcı
 * "Sepete ekle"ye basınca ürünler mevcut sepete girer ve sipariş her zaman
 * ödeme sayfasındaki "Siparişi onayla" adımında kullanıcının onayıyla oluşur.
 * Sohbet yalnızca cihazda saklanır.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, MessageCircle, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCart } from "@/hooks/useCart";
import { formatPrice } from "@/lib/format";
import { toPublicErrorMessage } from "@/lib/public-error";
import { askOrderAssistant } from "@/lib/ai-assistant.functions";
import type { CartProposal } from "@/lib/ai-assistant.types";

const STORAGE_KEY = "silvan.assistant.v1";
const MAX_HISTORY = 18;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  proposal?: CartProposal | null;
};

const GREETING: ChatMessage = {
  role: "assistant",
  content:
    "Merhaba! Ne yemek/içmek istediğinizi yazın, uygun işletmeyi ve ürünleri bulup sepet önerisi hazırlayayım. Siparişi her zaman siz onaylarsınız.",
};

export function OrderAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const ask = useServerFn(askOrderAssistant);
  const cart = useCart();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ChatMessage[];
        if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed);
      }
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
  }, [messages, open, busy]);

  async function send() {
    const text = draft.trim();
    if (!text || busy) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setDraft("");
    setBusy(true);
    try {
      const response = await ask({
        data: {
          messages: next
            .slice(-MAX_HISTORY)
            .map((message) => ({ role: message.role, content: message.content })),
        },
      });
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: response.reply,
          proposal: response.proposal ?? null,
        },
      ]);
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
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Sipariş asistanını aç"
          className="fixed bottom-20 right-4 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 sm:bottom-6"
        >
          <MessageCircle className="size-6" />
        </button>
      )}

      {open ? (
        <div className="fixed inset-x-2 bottom-2 z-50 flex max-h-[80vh] flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-xl sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-[24rem]">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <Sparkles className="size-4 shrink-0 text-primary" />
              <p className="min-w-0 truncate font-semibold">Sipariş asistanı</p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full text-xs"
                onClick={() => setMessages([GREETING])}
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
                {message.proposal ? (
                  <ProposalCard
                    proposal={message.proposal}
                    onAdd={() => addProposalToCart(message.proposal as CartProposal)}
                  />
                ) : null}
              </div>
            ))}
            {busy ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Yazıyor…
              </div>
            ) : null}
          </div>

          <form
            className="flex items-center gap-2 border-t border-border px-3 py-3"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Örn. akşama 2 kişilik pizza istiyorum"
              aria-label="Asistana mesaj yazın"
              className="rounded-full"
              disabled={busy}
            />
            <Button
              type="submit"
              size="icon"
              className="shrink-0 rounded-full"
              disabled={busy || draft.trim().length === 0}
              aria-label="Gönder"
            >
              <Send className="size-4" />
            </Button>
          </form>
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
