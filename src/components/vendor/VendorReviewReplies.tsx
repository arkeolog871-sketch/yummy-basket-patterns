import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { replyToReview } from "@/lib/compliance-review.functions";
import { toPublicErrorMessage } from "@/lib/public-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** İşletme: müşteri yorumlarına herkese açık cevap. */
export function VendorReviewReplies({ restaurantId }: { restaurantId: string }) {
  const reply = useServerFn(replyToReview);
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const { data } = useQuery({
    queryKey: ["vendor-reviews", restaurantId],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("reviews")
        .select("id, rating, comment, author_name, seller_reply, verified_order_id")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false })
        .limit(30);
      return rows ?? [];
    },
  });
  const send = useMutation({
    mutationFn: (id: string) => reply({ data: { reviewId: id, reply: drafts[id] ?? "" } }),
    onSuccess: async () => {
      toast.success("Cevabınız yayınlandı.");
      await qc.invalidateQueries({ queryKey: ["vendor-reviews", restaurantId] });
    },
    onError: (e) => toast.error(toPublicErrorMessage(e)),
  });
  if (!data?.length) return null;
  return (
    <section className="rounded-3xl border border-border/70 bg-card p-4 shadow-card">
      <h3 className="font-semibold">Yorumlara cevap</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Cevaplar herkese açıktır. Müşterinin kişisel bilgilerini yazmayın.
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        {data.map((r) => (
          <li key={r.id} className="rounded-2xl border border-border/60 p-3">
            <p className="font-semibold">
              {r.author_name} · {r.rating}/5 {r.verified_order_id ? "· Doğrulanmış sipariş" : ""}
            </p>
            {r.comment ? <p className="text-muted-foreground">{r.comment}</p> : null}
            <div className="mt-2 flex gap-2">
              <Input
                maxLength={600}
                placeholder={r.seller_reply ?? "Cevabınız"}
                value={drafts[r.id] ?? ""}
                onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
              />
              <Button
                size="sm"
                disabled={(drafts[r.id]?.trim().length ?? 0) < 2 || send.isPending}
                onClick={() => send.mutate(r.id)}
              >
                {r.seller_reply ? "Güncelle" : "Cevapla"}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
