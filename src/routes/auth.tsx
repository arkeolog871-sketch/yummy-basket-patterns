import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAccess } from "@/hooks/useAccess";
import { useServerFn } from "@tanstack/react-start";
import { registerWithEmailCode } from "@/lib/otp.functions";
import { EmailCodeLogin } from "@/components/auth/EmailCodeLogin";
import { VendorPhoneLogin } from "@/components/auth/VendorPhoneLogin";
import {
  completeGoogleOAuthFromCallback,
  GOOGLE_OAUTH_RETURN_PATH_KEY,
  humanizeOAuthError,
  isGoogleOAuthCallbackParams,
  isInAppBrowser,
  isOrphanedAndroidOAuthBrowser,
  nativeOAuthBridge,
  readGoogleOAuthPkce,
  returnToAndroidApp,
  startGoogleOAuth,
  stripOAuthCallbackFromUrl,
} from "@/lib/google-oauth";
import { useNativeGoogleSignIn } from "@/hooks/useNativeGoogleSignIn";
import {
  APPLE_OAUTH_RETURN_PATH_KEY,
  completeAppleOAuthFromCallback,
  humanizeOAuthError as humanizeAppleOAuthError,
  isAppleOAuthCallbackParams,
  isOrphanedAndroidAppleOAuthBrowser,
  returnToAndroidApp as returnToAndroidAppApple,
  startAppleOAuth,
} from "@/lib/apple-oauth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AuthSearch = {
  redirect?: string;
  error?: string;
  error_description?: string;
  code?: string;
  state?: string;
};

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): AuthSearch => {
    const next: AuthSearch = {};
    if (typeof search["redirect"] === "string" && search["redirect"])
      next.redirect = search["redirect"];
    if (typeof search["error"] === "string" && search["error"]) next.error = search["error"];
    if (typeof search["error_description"] === "string" && search["error_description"]) {
      next.error_description = search["error_description"];
    }
    if (typeof search["code"] === "string" && search["code"]) next.code = search["code"];
    if (typeof search["state"] === "string" && search["state"]) next.state = search["state"];
    return next;
  },
  head: () => ({
    meta: [
      { title: "Giriş yap veya kayıt ol — SİLVAN CEBİMDE" },
      {
        name: "description",
        content:
          "SİLVAN CEBİMDE hesabınıza giriş yapın veya saniyeler içinde yeni hesap oluşturun.",
      },
      { property: "og:title", content: "Giriş yap veya kayıt ol — SİLVAN CEBİMDE" },
      { property: "og:description", content: "Hesabınıza giriş yapın ve siparişinizi tamamlayın." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const {
    redirect,
    error: oauthError,
    error_description: oauthErrorDescription,
  } = Route.useSearch();
  const { user } = useAuth();
  const access = useAccess();
  const navigate = useNavigate();
  const register = useServerFn(registerWithEmailCode);
  const [portal, setPortal] = useState<"customer" | "vendor">("customer");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [method, setMethod] = useState<"password" | "code">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  // Apple'ın Android için native bir giriş SDK'sı yok; Android uygulamasında
  // tarayıcı tabanlı akış güvenilir uygulamaya dönemiyor. Apple'ın kendi App
  // Store incelemesi (Guideline 4.8) dışında bir gereksinim olmadığı için
  // burada hiç göstermiyoruz — iOS/web'de aynen kalıyor.
  // Sunucu bu köprüyü göremediği için ilk render'da mutlaka false olmalı.
  // Değeri useState başlatıcısında okumak, uygulama içinde sunucunun bastığı
  // Apple düğmesinin istemcide hiç basılmaması demekti; React bunu hydration
  // uyuşmazlığı sayıp (#418) giriş sayfasının ağacını atıp yeniden kuruyordu.
  // Gerçek değer bağlanmadan sonra yazılıyor.
  const [isAndroidNativeApp, setIsAndroidNativeApp] = useState(false);
  useEffect(() => {
    setIsAndroidNativeApp(Boolean(nativeOAuthBridge()));
  }, []);
  const [pendingVerification, setPendingVerification] = useState<{
    email: string;
    startAtCode: boolean;
  } | null>(null);
  // Sunucu URL'deki OAuth dönüş parametrelerini göremez, bu yüzden ilk
  // render'da mutlaka false olmalı. Değeri useState başlatıcısında okumak,
  // sunucunun bastığı giriş formuyla istemcinin bastığı "tamamlanıyor"
  // ekranını ayırıyordu; React bunu hydration uyuşmazlığı sayıp (#418) tüm
  // /auth ağacını atıp yeniden kuruyor ve bu sırada sayfa tepkisiz kalıyordu.
  // Gerçek değer aşağıdaki efektte, bağlanma sonrası yazılıyor.
  const [googleCompleting, setGoogleCompleting] = useState(false);
  const [androidHandoffPending, setAndroidHandoffPending] = useState(false);
  // Bu sekme akışı başlatmadıysa giriş burada değil, uygulamada tamamlanır.
  const [completesInApp, setCompletesInApp] = useState(false);
  const [appleCompleting, setAppleCompleting] = useState(false);
  const [appleAndroidHandoffPending, setAppleAndroidHandoffPending] = useState(false);
  useEffect(() => {
    if (isGoogleOAuthCallbackParams()) setGoogleCompleting(true);
    if (isAppleOAuthCallbackParams()) setAppleCompleting(true);
  }, []);
  // Native akış başlayıp başarısız olursa giriş sessizce ölmesin: tarayıcıya düş.
  const { busy: googleNativeBusy, start: startNativeGoogle } = useNativeGoogleSignIn(() => {
    void startBrowserGoogle();
  });

  useEffect(() => {
    if (!oauthError) return;
    if (isGoogleOAuthCallbackParams()) return;
    if (isAppleOAuthCallbackParams()) return;
    toast.error(humanizeOAuthError(oauthErrorDescription || oauthError));
  }, [oauthError, oauthErrorDescription]);

  useEffect(() => {
    if (!isGoogleOAuthCallbackParams()) return;
    // Google'ın dönüş sayfası Android'de ayrı bir tarayıcı sekmesinde açılabilir;
    // otomatik intent:// yönlendirmesi kullanıcı dokunuşu olmadan her Chrome/OEM'de
    // tetiklenmeyebilir, bu yüzden bu durumu yakalayıp elle "Uygulamaya dön" göster.
    const isAndroidHandoff = isOrphanedAndroidOAuthBrowser();
    if (isAndroidHandoff) setAndroidHandoffPending(true);
    if (!readGoogleOAuthPkce()?.nonce) setCompletesInApp(true);
    let cancelled = false;
    setGoogleCompleting(true);
    // Beklenmedik bir durumda ekran sonsuza kadar bekleme metninde kalmasın.
    const release = window.setTimeout(() => {
      if (!cancelled) setGoogleCompleting(false);
    }, 12_000);
    void completeGoogleOAuthFromCallback()
      .then((result) => {
        if (cancelled) return;
        stripOAuthCallbackFromUrl();
        if (result?.ok === false) {
          toast.error(result.error);
          setAndroidHandoffPending(false);
        }
        if (result?.ok === true && (isAndroidHandoff || !readGoogleOAuthPkce()?.nonce)) return;
        setGoogleCompleting(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        stripOAuthCallbackFromUrl();
        toast.error(
          humanizeOAuthError(
            error instanceof Error ? error.message : "Google girişi tamamlanamadı.",
          ),
        );
        setAndroidHandoffPending(false);
        setGoogleCompleting(false);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(release);
    };
  }, []);

  useEffect(() => {
    if (!isAppleOAuthCallbackParams()) return;
    // Apple'ın dönüş sayfası Android'de ayrı bir tarayıcı sekmesinde açılabilir;
    // otomatik intent:// yönlendirmesi kullanıcı dokunuşu olmadan her Chrome/OEM'de
    // tetiklenmeyebilir, bu yüzden bu durumu yakalayıp elle "Uygulamaya dön" göster.
    const isAndroidHandoff = isOrphanedAndroidAppleOAuthBrowser();
    if (isAndroidHandoff) setAppleAndroidHandoffPending(true);
    let cancelled = false;
    setAppleCompleting(true);
    const release = window.setTimeout(() => {
      if (!cancelled) setAppleCompleting(false);
    }, 12_000);
    void completeAppleOAuthFromCallback()
      .then((result) => {
        if (cancelled) return;
        stripOAuthCallbackFromUrl();
        if (result?.ok === false) {
          toast.error(result.error);
          setAppleAndroidHandoffPending(false);
        }
        if (result?.ok === true && isAndroidHandoff) return;
        setAppleCompleting(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        stripOAuthCallbackFromUrl();
        toast.error(
          humanizeAppleOAuthError(
            error instanceof Error ? error.message : "Apple girişi tamamlanamadı.",
          ),
        );
        setAppleAndroidHandoffPending(false);
        setAppleCompleting(false);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(release);
    };
  }, []);

  useEffect(() => {
    if (!user || access.loading) return;
    if (!user.email_confirmed_at) {
      if (user.email) setPendingVerification({ email: user.email, startAtCode: false });
      return;
    }

    // OAuth ile /isletme-basvuru sayfasından gelen kullanıcıyı önce oraya geri yönlendir.
    try {
      const googleReturn = sessionStorage.getItem(GOOGLE_OAUTH_RETURN_PATH_KEY);
      const appleReturn = sessionStorage.getItem(APPLE_OAUTH_RETURN_PATH_KEY);
      const oauthReturn = googleReturn || appleReturn;
      if (oauthReturn && oauthReturn.startsWith("/isletme-basvuru")) {
        sessionStorage.removeItem(GOOGLE_OAUTH_RETURN_PATH_KEY);
        sessionStorage.removeItem(APPLE_OAUTH_RETURN_PATH_KEY);
        navigate({ to: oauthReturn, replace: true });
        return;
      }
    } catch {
      /* private mode */
    }

    // Rolün varsayılan hedefi: sahip ve bölge yöneticisi /kurucu, işletme /vendor/dashboard.
    if (access.homePath !== "/") {
      navigate({ to: access.homePath, replace: true });
      return;
    }
    navigate({ to: redirect === "/odeme" ? "/odeme" : "/", replace: true });
  }, [user, access.loading, access.homePath, redirect, navigate]);

  const vendorPortal = portal === "vendor";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        if (phone.trim() && phone.replace(/\D/g, "").length < 10) {
          throw new Error("Telefon numarası en az 10 haneli olmalı.");
        }
        // Tek doğrulama akışı: hesap doğrulanmamış oluşturulur, 6 haneli kod gönderilir.
        const result = await register({
          data: { email: email.trim(), password, fullName: fullName.trim(), phone: phone.trim() },
        });
        if (!result.ok) throw new Error(result.error);
        setPendingVerification({ email: email.trim(), startAtCode: true });
        toast.success("Kayıt alındı. E-postanıza gönderilen 6 haneli kodu girin.");
      } else {
        const { data: signed, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (signed.user && !signed.user.email_confirmed_at) {
          await supabase.auth.signOut();
          setPendingVerification({ email: email.trim(), startAtCode: false });
          toast.error("E-posta adresiniz doğrulanmadı. Lütfen 6 haneli kodu isteyin.");
          return;
        }
        toast.success("Hoş geldiniz!");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bir şeyler ters gitti.");
    } finally {
      setBusy(false);
    }
  }

  async function startBrowserGoogle() {
    if (isInAppBrowser()) {
      toast.error(
        "Google girişi WhatsApp / Instagram / Facebook içi tarayıcıda çalışmaz. Bağlantıyı Chrome veya Safari ile açın.",
      );
      return;
    }
    try {
      const result = await startGoogleOAuth();
      if (!result.ok) toast.error(result.error);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Google girişi başlatılamadı.");
    }
  }

  async function handleGoogle() {
    // Credential Manager köprüsü varsa hesap seçimi uygulama içinde yapılır.
    if (startNativeGoogle()) return;
    await startBrowserGoogle();
  }

  async function handleApple() {
    if (isInAppBrowser()) {
      toast.error(
        "Apple girişi WhatsApp / Instagram / Facebook içi tarayıcıda çalışmaz. Bağlantıyı Chrome veya Safari ile açın.",
      );
      return;
    }
    try {
      const result = await startAppleOAuth();
      if (!result.ok) toast.error(humanizeAppleOAuthError(result.error));
    } catch (error) {
      toast.error(
        humanizeAppleOAuthError(
          error instanceof Error ? error.message : "Apple girişi başlatılamadı.",
        ),
      );
    }
  }

  if (googleCompleting) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-16">
        <h1 className="text-3xl">Google ile giriş</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {completesInApp
            ? "Giriş onaylandı. Uygulamaya dönün — giriş orada otomatik tamamlanıyor."
            : "Yetkilendirme tamamlanıyor, lütfen bekleyin…"}
        </p>
        {androidHandoffPending ? (
          <div className="mt-6 rounded-3xl border border-border bg-card p-5 text-sm">
            <p className="text-muted-foreground">
              Uygulama otomatik açılmadıysa aşağıdaki butona dokunun.
            </p>
            <Button className="mt-3 w-full rounded-full" onClick={() => returnToAndroidApp()}>
              Uygulamaya dön
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  if (appleCompleting) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-16">
        <h1 className="text-3xl">Apple ile giriş</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Yetkilendirme tamamlanıyor, lütfen bekleyin…
        </p>
        {appleAndroidHandoffPending ? (
          <div className="mt-6 rounded-3xl border border-border bg-card p-5 text-sm">
            <p className="text-muted-foreground">
              Uygulama otomatik açılmadıysa aşağıdaki butona dokunun.
            </p>
            <Button className="mt-3 w-full rounded-full" onClick={() => returnToAndroidAppApple()}>
              Uygulamaya dön
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <div className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1 text-sm">
        {(
          [
            ["customer", "Müşteri girişi"],
            ["vendor", "İşletme girişi"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            data-testid={`auth-portal-${value}`}
            onClick={() => {
              setPortal(value);
              if (value === "vendor") setMode("signin");
            }}
            className={`rounded-full px-3 py-2 transition ${
              portal === value
                ? "bg-card font-medium shadow-card"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <h1 className="mt-6 text-3xl" data-testid="auth-heading">
        {vendorPortal ? "İşletme girişi" : mode === "signin" ? "Giriş yap" : "Hesap oluştur"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {vendorPortal
          ? "Telefon numaranızı girin, hesabınıza tek kullanımlık şifre gönderilir. İşletme hesapları sayfa yöneticisi tarafından tanımlanır."
          : "Sipariş vermek ve adreslerinizi kaydetmek için hesabınızı kullanın."}
      </p>

      {mode === "signin" && !vendorPortal ? (
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
              data-testid={`auth-method-${value}`}
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
      ) : null}

      {vendorPortal ? (
        <div className="mt-8 space-y-4 rounded-3xl border border-border/70 bg-card p-4 shadow-card sm:p-6">
          <VendorPhoneLogin />
          <div className="border-t border-border/70 pt-4 text-center">
            <p className="text-sm text-muted-foreground">İşletmeniz yok mu?</p>
            <Link
              to="/isletme-basvuru"
              className="mt-2 inline-flex w-full items-center justify-center rounded-full border border-border px-4 py-2 text-sm font-medium transition hover:bg-secondary"
            >
              Başvuru yapın
            </Link>
          </div>
        </div>
      ) : pendingVerification ? (
        <div className="mt-6 space-y-4 rounded-3xl border border-border/70 bg-card p-4 shadow-card sm:p-6">
          <p className="text-sm text-muted-foreground">
            Hesabınız oluşturuldu ancak <strong>e-posta doğrulanmadı</strong>.{" "}
            {pendingVerification.email} adresine gönderilen 6 haneli kodu girerek hesabınızı aktif
            edin.
          </p>
          <EmailCodeLogin
            idPrefix="signup-otp"
            allowSignUp={false}
            initialEmail={pendingVerification.email}
            startAtCode={pendingVerification.startAtCode}
            onVerified={() => {
              setPendingVerification(null);
              toast.success("E-postanız doğrulandı, hoş geldiniz!");
            }}
          />
        </div>
      ) : mode === "signin" && method === "code" ? (
        <div className="mt-6 rounded-3xl border border-border/70 bg-card p-4 shadow-card sm:p-6">
          <EmailCodeLogin
            idPrefix="user-otp"
            allowSignUp={false}
            initialEmail={email}
            onVerified={() => {
              toast.success("Giriş başarılı!");
            }}
          />
        </div>
      ) : (
        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="mt-8 space-y-4 rounded-3xl border border-border/70 bg-card p-4 shadow-card sm:p-6"
        >
          {mode === "signup" ? (
            <div className="space-y-2">
              <Label htmlFor="fullName">Ad soyad</Label>
              <Input
                id="fullName"
                name="name"
                autoComplete="name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
                className="rounded-xl"
              />
            </div>
          ) : null}
          {mode === "signup" ? (
            <div className="space-y-2">
              <Label htmlFor="phone">Telefon numarası (opsiyonel)</Label>
              <Input
                id="phone"
                name="tel"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="05xx xxx xx xx"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="rounded-xl"
              />
              <p className="text-xs text-muted-foreground">
                Sipariş verirken kurye iletişimi için adres adımında istenir.
              </p>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="email">E-posta</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Şifre</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              required
              className="rounded-xl"
            />
          </div>
          <Button type="submit" disabled={busy} className="w-full rounded-full" size="lg">
            {mode === "signin" ? "Giriş yap" : "Kayıt ol"}
          </Button>
        </form>
      )}

      {vendorPortal ? null : (
        <>
          <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            veya
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="mt-4 w-full rounded-full"
            disabled={googleNativeBusy}
            onClick={() => void handleGoogle()}
          >
            {googleNativeBusy ? "Google hesabı seçiliyor…" : "Google ile devam et"}
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Google, uygulamanın kendi alan adına döner. Android uygulamasında sistem tarayıcısı
            (Chrome) açılır. WhatsApp, Instagram veya Facebook içi tarayıcıda çalışmaz. E-posta kodu
            ile giriş her zaman kullanılabilir.
          </p>

          {isAndroidNativeApp ? null : (
            <>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="mt-3 w-full rounded-full"
                onClick={() => void handleApple()}
              >
                Apple ile devam et
              </Button>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Apple ile giriş, uygulamanın kendi alan adına döner. iPhone veya iPad'de Safari ile en
                iyi sonucu verir. Supabase Auth üzerinde Apple sağlayıcısı etkinleştirildikten sonra
                çalışır.
              </p>
            </>
          )}
        </>
      )}

      {vendorPortal ? (
        <p className="mt-5 text-center text-xs text-muted-foreground">
          İşletme hesabınız yok mu? Sayfa yöneticisi ekiple iletişime geçerek işletmenizi
          tanımlatın.
        </p>
      ) : (
        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          data-testid="auth-toggle-mode"
          className="mt-5 w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          {mode === "signin"
            ? "Hesabınız yok mu? Kayıt olun"
            : "Zaten hesabınız var mı? Giriş yapın"}
        </button>
      )}
    </div>
  );
}
