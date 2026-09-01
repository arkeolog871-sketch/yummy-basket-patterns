import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { EmailCodeLogin } from "@/components/auth/EmailCodeLogin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { getMyDeletionRequest, requestAccountDeletion } from "@/lib/account.functions";
import { getMyProfile, updateMyProfile } from "@/lib/profile.functions";
import { toPublicErrorMessage } from "@/lib/public-error";

const DELETION_CONFIRMATION =
  "Talebiniz alındı. Hesabınız ve verileriniz, yasal saklama süreleri gereği tutulması zorunlu kayıtlar hariç en geç 30 gün içinde silinecektir.";

export const Route = createFileRoute("/hesabim")({
  head: () => ({
    meta: [
      { title: "Hesabım ve veri silme talebi — SİLVAN CEBİMDE" },
      {
        name: "description",
        content:
          "Hesap bilgilerinizi görün, hesabınızın ve kişisel verilerinizin silinmesi için talep oluşturun.",
      },
      { property: "og:title", content: "Hesabım — SİLVAN CEBİMDE" },
      { property: "og:description", content: "Hesap ve veri silme talebi oluşturun." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireAuth>
      <AccountPage />
    </RequireAuth>
  ),
});

function VerificationBadge({ verified, label }: { verified: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
        verified ? "bg-success/15 text-success" : "bg-warm text-warm-foreground"
      }`}
    >
      {verified ? <CheckCircle2 className="size-3.5" /> : <CircleAlert className="size-3.5" />}
      {label}
    </span>
  );
}

function ProfileSection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);
  const saveProfile = useServerFn(updateMyProfile);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [showEmailVerify, setShowEmailVerify] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => fetchProfile(),
  });

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? "");
    setPhone(profile.phone ?? "");
  }, [profile]);

  const save = useMutation({
    mutationFn: () =>
      saveProfile({ data: { full_name: fullName.trim() || null, phone: phone.trim() } }),
    onSuccess: () => {
      toast.success("Profil bilgileri güncellendi");
      void queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    },
    onError: (error) => toast.error(toPublicErrorMessage(error, "Profil güncellenemedi.")),
  });

  return (
    <section className="mt-6 rounded-3xl border border-border/70 bg-card p-5 shadow-card">
      <p className="font-semibold">Profil bilgileri</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Sipariş verebilmek için e-posta adresinizin doğrulanmış olması zorunludur.
      </p>

      {isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Yükleniyor…</p>
      ) : (
        <div className="mt-4 space-y-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{user?.email ?? "—"}</span>
              <VerificationBadge
                verified={Boolean(profile?.email_verified)}
                label={profile?.email_verified ? "E-posta doğrulandı" : "E-posta doğrulanmadı"}
              />
            </div>
            {!profile?.email_verified ? (
              showEmailVerify ? (
                <div className="mt-3 max-w-sm rounded-2xl border border-border/70 bg-muted/30 p-4">
                  <EmailCodeLogin
                    idPrefix="account-email-verify"
                    allowSignUp={false}
                    initialEmail={user?.email ?? ""}
                    onVerified={async () => {
                      toast.success("E-posta doğrulandı");
                      setShowEmailVerify(false);
                      void queryClient.invalidateQueries({ queryKey: ["my-profile"] });
                    }}
                  />
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 rounded-full"
                  onClick={() => setShowEmailVerify(true)}
                >
                  E-postamı doğrula
                </Button>
              )
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="profile-full-name">Ad soyad</Label>
              <Input
                id="profile-full-name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="profile-phone">Telefon</Label>
                <VerificationBadge
                  verified={Boolean(profile?.phone_verified)}
                  label={profile?.phone_verified ? "Doğrulandı" : "Doğrulanmadı"}
                />
              </div>
              <Input
                id="profile-phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="05xx xxx xx xx"
                className="rounded-xl"
              />
              <p className="text-xs text-muted-foreground">
                SMS ile telefon doğrulaması yakında eklenecek.
              </p>
            </div>
          </div>

          <Button className="rounded-full" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Kaydediliyor…" : "Kaydet"}
          </Button>
        </div>
      )}
    </section>
  );
}

function AccountPage() {
  const fetchRequest = useServerFn(getMyDeletionRequest);
  const submitRequest = useServerFn(requestAccountDeletion);
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const { data: existing, isLoading } = useQuery({
    queryKey: ["account-deletion-request"],
    queryFn: () => fetchRequest(),
  });

  const create = useMutation({
    mutationFn: () => submitRequest({ data: { reason: reason.trim() || null } }),
    onSuccess: () => {
      toast.success(DELETION_CONFIRMATION);
      setReason("");
      setConfirmed(false);
      void queryClient.invalidateQueries({ queryKey: ["account-deletion-request"] });
    },
    onError: (error) => toast.error(toPublicErrorMessage(error, "Talep oluşturulamadı.")),
  });

  const pending = existing?.status === "pending";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-3xl">Hesabım</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Profil bilgilerinizi düzenleyin, siparişlerinize ulaşın veya hesabınızın silinmesini talep
        edin.
      </p>

      <ProfileSection />

      <section className="mt-6 rounded-3xl border border-border/70 bg-card p-5 shadow-card">
        <p className="font-semibold">Bağlantılar</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/siparislerim">Siparişlerim</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/adreslerim">Adreslerim</Link>
          </Button>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-border/70 bg-card p-5 shadow-card">
        <p className="font-semibold">Hesabımı ve verilerimi sil</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Talebinizi gönderdiğinizde hesabınız ve kişisel verileriniz (adres, sipariş iletişim
          bilgileri, oturum kayıtları) yasal saklama süreleri gereği tutulması zorunlu kayıtlar
          hariç silinir veya anonimleştirilir. Detaylar için{" "}
          <Link to="/kvkk" className="underline underline-offset-4">
            KVKK Aydınlatma Metni
          </Link>{" "}
          ve{" "}
          <Link to="/gizlilik-politikasi" className="underline underline-offset-4">
            Gizlilik Politikası
          </Link>
          .
        </p>

        {isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">Yükleniyor…</p>
        ) : pending ? (
          <div className="mt-4 rounded-2xl border border-primary/40 bg-secondary/60 p-4 text-sm">
            <p className="font-semibold">Silme talebiniz kayıtlarımızda</p>
            <p className="mt-1 text-muted-foreground">{DELETION_CONFIRMATION}</p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Silme gerekçenizi yazabilirsiniz (isteğe bağlı)."
              className="rounded-2xl"
            />
            <label className="flex items-start gap-3 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="mt-1"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              <span>
                Hesabımın ve verilerimin silinmesini talep ettiğimi, bu işlemin geri alınamayacağını
                ve sipariş geçmişime erişemeyeceğimi anlıyorum.
              </span>
            </label>
            <Button
              variant="destructive"
              className="rounded-full"
              disabled={!confirmed || create.isPending}
              onClick={() => create.mutate()}
            >
              {create.isPending ? "Talep gönderiliyor…" : "Silme talebi gönder"}
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
