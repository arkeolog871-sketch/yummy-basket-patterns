import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Crown, Lock, Mail, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logFounderLoginAttempt } from "@/lib/audit.functions";
import { redeemBackupCode } from "@/lib/security.functions";
import { markBackupCodeVerified, readTwoFactorState } from "@/lib/two-factor";
import { useAuth } from "@/hooks/useAuth";
import { EmailCodeLogin } from "@/components/auth/EmailCodeLogin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/kurucu-giris")({
  head: () => ({
    meta: [
      { title: "Kurucu Girişi — SofraKapımda" },
      {
        name: "description",
        content: "SofraKapımda kurucu yönetim portalına iki adımlı doğrulamalı güvenli giriş.",
      },
      { property: "og:title", content: "Kurucu Girişi — SofraKapımda" },
      { property: "og:description", content: "Kurucu yönetim portalı girişi." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FounderLoginPage,
});

async function readFounderState(userId: string) {
  const [own, founders] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "founder"),
    supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "founder"),
  ]);
  if (own.error) throw new Error(own.error.message);
  return {
    isFounder: (own.data ?? []).length > 0,
    founderExists: (founders.count ?? 0) > 0,
  };
}

type Step = "password" | "mfa" | "forgot";

function FounderLoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const redeem = useServerFn(redeemBackupCode);
  const [step, setStep] = useState<Step>("password");
  const [method, setMethod] = useState<"password" | "code">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [useBackup, setUseBackup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);

  // Zaten oturumu olan bir kurucu doğrudan panele gider (ikinci adım tamamsa).
  useEffect(() => {
    if (loading || !user || step === "mfa") return;
    let active = true;
    setChecking(true);
    void (async () => {
      const state = await readFounderState(user.id);
      const mfa = await readTwoFactorState(user.id);
      if (!active) return;
      if (mfa.enrolled && !mfa.satisfied) {
        setFactorId(mfa.factorId);
        setStep("mfa");
        return;
      }
      if (state.isFounder || !state.founderExists) {
        navigate({ to: "/kurucu", replace: true });
      }
    })()
      .catch(() => {})
      .finally(() => active && setChecking(false));
    return () => {
      active = false;
    };
  }, [user, loading, navigate, step]);

  async function continueAfterAuth(userId: string, loginEmail: string) {
    const state = await readFounderState(userId);
    if (!state.isFounder && state.founderExists) {
      void logFounderLoginAttempt({
        data: { email: loginEmail, status: "denied", reason: "Kurucu yetkisi yok" },
      }).catch(() => {});
      await supabase.auth.signOut();
      toast.error("Bu hesabın kurucu yetkisi yok.");
      return;
    }

    const mfa = await readTwoFactorState(userId);
    if (mfa.enrolled && !mfa.satisfied) {
      setFactorId(mfa.factorId);
      setStep("mfa");
      toast.info("İki adımlı doğrulama kodunu girin.");
      return;
    }

    void logFounderLoginAttempt({
      data: { email: loginEmail, status: "success" },
    }).catch(() => {});
    toast.success(state.isFounder ? "Kurucu paneline hoş geldiniz" : "Kurucu profili tanımlanabilir");
    navigate({ to: "/kurucu", replace: true });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        void logFounderLoginAttempt({
          data: { email, status: "error", reason: error.message },
        }).catch(() => {});
        throw error;
      }
      const signedIn = data.user;
      if (!signedIn) throw new Error("Oturum açılamadı");
      await continueAfterAuth(signedIn.id, email);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Giriş yapılamadı.");
    } finally {
      setBusy(false);
    }
  }

  async function handleMfa(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const { data: sessionData } = await supabase.auth.getUser();
      const currentUser = sessionData.user;
      if (!currentUser) throw new Error("Oturum bulunamadı, yeniden giriş yapın.");

      if (useBackup) {
        await redeem({ data: { code: otp } });
        markBackupCodeVerified(currentUser.id);
      } else {
        if (!factorId) throw new Error("Doğrulama yöntemi bulunamadı.");
        const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: otp.trim() });
        if (error) throw error;
      }

      void logFounderLoginAttempt({
        data: {
          email: currentUser.email ?? email,
          status: "success",
          reason: useBackup ? "Yedek kod ile doğrulandı" : "2FA doğrulandı",
          
        },
      }).catch(() => {});
      toast.success("Doğrulama tamamlandı");
      navigate({ to: "/kurucu", replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Doğrulama başarısız.";
      void logFounderLoginAttempt({
        data: { email, status: "denied", reason: message },
      }).catch(() => {});
      toast.error(message);
    } finally {
      setBusy(false);
      setOtp("");
    }
  }

  async function handleForgot(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/sifre-sifirlama`,
      });
      if (error) throw error;
      void logFounderLoginAttempt({
        data: { email, status: "success", reason: "Şifre sıfırlama bağlantısı istendi" },
      }).catch(() => {});
      toast.success("Sıfırlama bağlantısı e-postanıza gönderildi.");
      setStep("password");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bağlantı gönderilemedi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-warm/40 px-4 py-16">
      <div className="w-full max-w-md">
        <div className="text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-3xl bg-gradient-warm text-primary-foreground shadow-glow">
            <Crown className="size-6" />
          </span>
          <h1 className="mt-5 text-3xl">
            {step === "forgot" ? "Şifremi unuttum" : step === "mfa" ? "İki adımlı doğrulama" : "Kurucu girişi"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {step === "forgot"
              ? "Kurucu e-postanızı girin, güvenli sıfırlama bağlantısını gönderelim."
              : step === "mfa"
                ? "Doğrulama uygulamanızdaki 6 haneli kodu ya da yedek kodlarınızdan birini girin."
                : "Bu portal yalnızca kurucu hesabı içindir ve normal kullanıcı girişinden bağımsızdır."}
          </p>
        </div>

        {step === "password" ? (
          <>
          <div className="mt-6 grid grid-cols-2 gap-1 rounded-full bg-muted p-1 text-sm">
            {(
              [
                ["password", "Şifre ile"],
                ["code", "E-posta kodu ile"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMethod(value)}
                className={`rounded-full px-3 py-2 transition ${
                  method === value
                    ? "bg-card font-medium shadow-card"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {method === "code" ? (
            <div className="mt-5 rounded-3xl border border-border/70 bg-card p-6 shadow-card">
              <EmailCodeLogin
                idPrefix="founder-otp"
                allowSignUp={false}
                initialEmail={email}
                onVerified={async (userId, verifiedEmail) => {
                  setEmail(verifiedEmail);
                  await continueAfterAuth(userId, verifiedEmail);
                }}
                onFailed={(failedEmail, message) => {
                  void logFounderLoginAttempt({
                    data: {
                      email: failedEmail || email,
                      status: "error",
                      reason: `E-posta kodu: ${message}`.slice(0, 200),
                    },
                  }).catch(() => {});
                }}
              />
              <p className="mt-4 text-xs text-muted-foreground">
                Kod yalnızca kayıtlı kurucu e-postasına gönderilir; yetkisiz hesaplar otomatik
                olarak çıkış yapılır.
              </p>
            </div>
          ) : (
          <form
            onSubmit={(event) => void handleSubmit(event)}
            className="mt-5 space-y-4 rounded-3xl border border-border/70 bg-card p-6 shadow-card"
          >
            <div className="space-y-2">
              <Label htmlFor="founder-email">Kurucu e-postası</Label>
              <Input
                id="founder-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="founder-password">Şifre</Label>
              <Input
                id="founder-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={6}
                required
                className="rounded-xl"
              />
            </div>
            <Button type="submit" size="lg" disabled={busy || checking} className="w-full rounded-full">
              <Lock className="size-4" /> {busy ? "Doğrulanıyor…" : "Kurucu olarak giriş yap"}
            </Button>
            <button
              type="button"
              className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => setStep("forgot")}
            >
              Şifremi unuttum
            </button>
            <p className="text-xs text-muted-foreground">
              Yetkisiz hesaplarla yapılan girişler otomatik olarak kapatılır.
            </p>
          </form>
          )}
          </>
        ) : null}

        {step === "forgot" ? (
          <form
            onSubmit={(event) => void handleForgot(event)}
            className="mt-8 space-y-4 rounded-3xl border border-border/70 bg-card p-6 shadow-card"
          >
            <div className="space-y-2">
              <Label htmlFor="forgot-email">Kurucu e-postası</Label>
              <Input
                id="forgot-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="rounded-xl"
              />
            </div>
            <Button type="submit" size="lg" disabled={busy} className="w-full rounded-full">
              <Mail className="size-4" /> {busy ? "Gönderiliyor…" : "Sıfırlama bağlantısı gönder"}
            </Button>
            <button
              type="button"
              className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => setStep("password")}
            >
              Girişe dön
            </button>
          </form>
        ) : null}

        {step === "mfa" ? (
          <form
            onSubmit={(event) => void handleMfa(event)}
            className="mt-8 space-y-4 rounded-3xl border border-border/70 bg-card p-6 shadow-card"
          >
            <div className="space-y-2">
              <Label htmlFor="otp">{useBackup ? "Yedek kod" : "Doğrulama kodu"}</Label>
              <Input
                id="otp"
                inputMode={useBackup ? "text" : "numeric"}
                autoComplete="one-time-code"
                value={otp}
                onChange={(event) => setOtp(event.target.value)}
                placeholder={useBackup ? "XXXX-XXXX" : "123456"}
                required
                className="rounded-xl tracking-widest"
              />
            </div>
            <Button type="submit" size="lg" disabled={busy} className="w-full rounded-full">
              <ShieldCheck className="size-4" /> {busy ? "Doğrulanıyor…" : "Doğrula ve devam et"}
            </Button>
            <button
              type="button"
              className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => {
                setUseBackup((value) => !value);
                setOtp("");
              }}
            >
              {useBackup ? "Doğrulama uygulaması kodunu kullan" : "Yedek kod kullan"}
            </button>
          </form>
        ) : null}

        <div className="mt-5 flex justify-center gap-4 text-sm">
          <Link to="/" className="text-muted-foreground underline-offset-4 hover:underline">
            Siteye dön
          </Link>
          <Link to="/auth" className="text-muted-foreground underline-offset-4 hover:underline">
            Kullanıcı girişi
          </Link>
        </div>
      </div>
    </div>
  );
}
