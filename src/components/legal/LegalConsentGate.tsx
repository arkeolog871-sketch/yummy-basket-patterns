import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { acceptLegalTerms, getLegalConsentRequirement } from "@/lib/legal.functions";
import { TERMS_ACCEPTANCE_REQUIRED } from "@/lib/legal";
import { LegalConsentCheckbox } from "@/components/legal/LegalConsentCheckbox";
import { Button } from "@/components/ui/button";

/**
 * Yeni açılan hesaplardan yasal onay ister.
 *
 * E-posta kodu ve işletme telefonu akışlarında onay zaten kod ekranında
 * alınıyor; Google/Apple ile açılan hesaplarda alınacak bir yer yoktu ve
 * kayıt hiç oluşmuyordu. Sunucu, onayı olmayan **ve yeni oluşturulmuş**
 * hesapları işaretliyor; eski hesaplara dokunulmuyor, girişleri engellenmiyor.
 *
 * Radix Dialog yerine düz bir katman: paylaşılan DialogContent'in kapatma
 * çarpısı bu ekranda olmamalı ve o bileşeni değiştirmek diğer kullanımları
 * etkilerdi. Yasal metinler kendi diyaloglarında (z-50) bunun üstünde açılır.
 */
export function LegalConsentGate() {
  const { user, loading } = useAuth();
  const fetchRequirement = useServerFn(getLegalConsentRequirement);
  const accept = useServerFn(acceptLegalTerms);
  const queryClient = useQueryClient();
  const [checked, setChecked] = useState(false);

  const { data } = useQuery({
    queryKey: ["legal-consent", user?.id ?? "anon"],
    enabled: Boolean(user) && !loading,
    queryFn: () => fetchRequirement(),
    staleTime: 60_000,
    retry: false,
  });

  const required = Boolean(data?.required);

  useEffect(() => {
    if (!required) setChecked(false);
  }, [required]);

  const confirm = useMutation({
    mutationFn: async () => accept(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["legal-consent"] });
    },
    onError: () => toast.error("Onay kaydedilemedi. Lütfen tekrar deneyin."),
  });

  if (!required) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-lifted">
        <h2 className="text-xl font-semibold">Son bir adım</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Hesabınızı kullanmaya başlamadan önce aşağıdaki metinleri onaylamanız gerekiyor.
          Başlıklara dokunarak tamamını okuyabilirsiniz.
        </p>

        <LegalConsentCheckbox
          id="legal-consent-gate"
          checked={checked}
          disabled={confirm.isPending}
          onCheckedChange={setChecked}
        />

        <Button
          className="mt-4 w-full rounded-full"
          size="lg"
          disabled={confirm.isPending}
          onClick={() => {
            if (!checked) {
              toast.error(TERMS_ACCEPTANCE_REQUIRED);
              return;
            }
            confirm.mutate();
          }}
        >
          {confirm.isPending ? "Kaydediliyor…" : "Onaylıyorum, devam et"}
        </Button>

        <button
          type="button"
          disabled={confirm.isPending}
          onClick={() => {
            void supabase.auth.signOut();
          }}
          className="mt-3 w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          Vazgeç ve çıkış yap
        </button>
      </div>
    </div>
  );
}
