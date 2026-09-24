import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { LEGAL_DOCUMENTS } from "@/lib/legal";
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
  const [later, setLater] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Yasal belge sayfalarında onay kartı gösterilmez: belge okunabilmeli.
  const onLegalPage =
    pathname.startsWith("/yasal") ||
    Object.values(LEGAL_DOCUMENTS).some((doc) => doc.path === pathname);

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

  if (!required || later || onLegalPage) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto max-h-[70dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-border bg-card p-5 shadow-lifted">
        <h2 className="text-xl font-semibold">Son bir adım</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Kullanım Koşulları güncellendi (sürüm 3). Onayınız hesap ve sipariş işlemleri için
          gereklidir; KVKK Aydınlatma Metni yalnızca bilgilendirmedir.
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
        <button
          type="button"
          onClick={() => setLater(true)}
          className="mt-2 w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          Daha sonra
        </button>
      </div>
    </div>
  );
}
