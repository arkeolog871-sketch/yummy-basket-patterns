import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmailCodeLogin } from "@/components/auth/EmailCodeLogin";
import { VerificationBadge } from "@/components/account/VerificationBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { getMyProfile, updateMyProfile } from "@/lib/profile.functions";
import { toPublicErrorMessage } from "@/lib/public-error";

export function ProfileSection() {
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

  const hasSavedPhone = Boolean(profile?.phone && profile.phone.trim().length >= 10);

  return (
    <section className="rounded-3xl border border-border/70 bg-card p-5 shadow-card">
      <p className="font-semibold">Kişisel bilgiler</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Sipariş verebilmek için önce telefon numaranızı kaydedip ardından e-posta adresinizi
        doğrulamanız gerekir.
      </p>

      {isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Yükleniyor…</p>
      ) : (
        <div className="mt-4 space-y-4">
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

          <div className="border-t border-border/70 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{user?.email ?? "—"}</span>
              <VerificationBadge
                verified={Boolean(profile?.email_verified)}
                label={profile?.email_verified ? "E-posta doğrulandı" : "E-posta doğrulanmadı"}
              />
            </div>
            {!profile?.email_verified ? (
              !hasSavedPhone ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  E-postanızı doğrulamadan önce yukarıdan telefon numaranızı girip
                  <strong> Kaydet</strong>'e basın.
                </p>
              ) : showEmailVerify ? (
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
        </div>
      )}
    </section>
  );
}
