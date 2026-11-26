import { useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useAccess } from "@/hooks/useAccess";
import { getMyProfile, completeFullName } from "@/lib/profile.functions";
import { toPublicErrorMessage } from "@/lib/public-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * E-postası doğrulanmış müşteri hesaplarında (vendor/kurucu/bölge yöneticisi
 * hariç) profilde ad soyad yoksa, çocuk içerik yerine zorunlu bir "ad soyad
 * girin" formu gösterir.
 *
 * YAŞANDI: bu kontrol önce yalnızca /auth sayfasının kendi akışına
 * eklenmişti. İşletme başvuru sayfasının (isletme-basvuru.tsx) ayrı,
 * bağımsız Google/Apple giriş düğmeleri olduğu ve hiç /auth'a uğramadığı
 * için, oradan Apple/Google ile giriş yapıp (Apple genelde isim
 * paylaşmıyor) başvuruyu yarıda bırakanlar adı hiç girmeden hesap
 * açabiliyordu. Bu bileşen, yeni bir giriş noktası eklendiğinde aynı
 * boşluğun tekrarlanmaması için paylaşılan tek nokta olarak tasarlandı.
 */
export function FullNameGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const access = useAccess();
  const queryClient = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);
  const saveFullName = useServerFn(completeFullName);
  const [fullNameInput, setFullNameInput] = useState("");
  const [busy, setBusy] = useState(false);

  const isCustomerAccount = !access.isVendor && !access.isFounder && !access.isPageManager;
  const profileQuery = useQuery({
    queryKey: ["my-profile-gate", user?.id ?? "anon"],
    enabled: Boolean(user) && isCustomerAccount,
    queryFn: () => fetchProfile(),
  });

  if (!user) return null;
  if (access.loading) {
    return <p className="mx-auto max-w-md px-4 py-16 text-sm text-muted-foreground">Yükleniyor…</p>;
  }
  if (isCustomerAccount && profileQuery.isLoading) {
    return <p className="mx-auto max-w-md px-4 py-16 text-sm text-muted-foreground">Yükleniyor…</p>;
  }
  if (!isCustomerAccount || profileQuery.data?.full_name?.trim()) {
    return <>{children}</>;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = fullNameInput.trim();
    if (trimmed.length < 2) {
      toast.error("Ad soyad girin.");
      return;
    }
    setBusy(true);
    try {
      await saveFullName({ data: { full_name: trimmed } });
      await queryClient.invalidateQueries({ queryKey: ["my-profile-gate", user?.id ?? "anon"] });
    } catch (error) {
      toast.error(toPublicErrorMessage(error, "Ad soyad kaydedilemedi."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <div className="space-y-4 rounded-3xl border border-border/70 bg-card p-4 shadow-card sm:p-6">
        <p className="text-sm text-muted-foreground">
          Hesabınızı tamamlamak için <strong>ad soyadınızı</strong> girin. Bu, Google/Apple ile
          girişte paylaşılmamış olabilir; devam etmek için gereklidir.
        </p>
        <form onSubmit={(event) => void submit(event)} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="gate-full-name">Ad soyad</Label>
            <Input
              id="gate-full-name"
              autoComplete="name"
              value={fullNameInput}
              onChange={(event) => setFullNameInput(event.target.value)}
              required
              autoFocus
              className="rounded-xl"
            />
          </div>
          <Button type="submit" disabled={busy} className="w-full rounded-full" size="lg">
            {busy ? "Kaydediliyor…" : "Devam et"}
          </Button>
        </form>
      </div>
    </div>
  );
}
