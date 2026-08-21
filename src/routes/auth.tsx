import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAccess } from "@/hooks/useAccess";
import { EmailCodeLogin } from "@/components/auth/EmailCodeLogin";
import { VendorPhoneLogin } from "@/components/auth/VendorPhoneLogin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AuthSearch = { redirect?: string };

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): AuthSearch =>
    typeof search["redirect"] === "string" && search["redirect"]
      ? { redirect: search["redirect"] }
      : {},
  head: () => ({
    meta: [
      { title: "Giriş yap veya kayıt ol — SİLVAN CEBİMDE" },
      {
        name: "description",
        content: "SİLVAN CEBİMDE hesabınıza giriş yapın veya saniyeler içinde yeni hesap oluşturun.",
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
  const { redirect } = Route.useSearch();
  const { user } = useAuth();
  const access = useAccess();
  const navigate = useNavigate();
  const [portal, setPortal] = useState<"customer" | "vendor">("customer");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [method, setMethod] = useState<"password" | "code">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || access.loading) return;
    if (access.isFounder) {
      navigate({ to: "/kurucu", replace: true });
      return;
    }
    if (access.isVendor) {
      navigate({ to: "/vendor/dashboard", replace: true });
      return;
    }
    navigate({ to: redirect === "/odeme" ? "/odeme" : "/", replace: true });
  }, [user, access.loading, access.isFounder, access.isVendor, redirect, navigate]);

  const vendorPortal = portal === "vendor";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        if (phone.replace(/\D/g, "").length < 10) {
          throw new Error("Telefon numarası en az 10 haneli olmalı.");
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: fullName, phone },
          },
        });
        if (error) throw error;
        toast.success("Kayıt alındı. E-postanızı doğrulayın.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Hoş geldiniz!");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bir şeyler ters gitti.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    try {
      const { lovable } = await import("@/integrations/lovable");
      await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Google girişi başlatılamadı.");
    }
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

      <h1 className="mt-6 text-3xl">
        {vendorPortal ? "İşletme girişi" : mode === "signin" ? "Giriş yap" : "Hesap oluştur"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {vendorPortal
          ? "Telefon numaranızı girin, hesabınıza tek kullanımlık şifre gönderilir. İşletme hesapları kurucu tarafından tanımlanır."
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
        <div className="mt-8 rounded-3xl border border-border/70 bg-card p-6 shadow-card">
          <VendorPhoneLogin />
        </div>
      ) : mode === "signin" && method === "code" ? (
        <div className="mt-6 rounded-3xl border border-border/70 bg-card p-6 shadow-card">
          <EmailCodeLogin
            idPrefix="user-otp"
            initialEmail={email}
            onVerified={() => {
              toast.success("Giriş başarılı!");
            }}
          />
        </div>
      ) : (
      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="mt-8 space-y-4 rounded-3xl border border-border/70 bg-card p-6 shadow-card"
      >
        {mode === "signup" ? (
          <div className="space-y-2">
            <Label htmlFor="fullName">Ad soyad</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
              className="rounded-xl"
            />
          </div>
        ) : null}
        {mode === "signup" ? (
          <div className="space-y-2">
            <Label htmlFor="phone">Telefon numarası</Label>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="05xx xxx xx xx"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              required
              className="rounded-xl"
            />
            <p className="text-xs text-muted-foreground">
              Kurye iletişimi ve giriş doğrulaması için zorunludur.
            </p>
          </div>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="email">E-posta</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
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
            onClick={() => void handleGoogle()}
          >
            Google ile devam et
          </Button>
        </>
      )}

      {vendorPortal ? (
        <p className="mt-5 text-center text-xs text-muted-foreground">
          İşletme hesabınız yok mu? Kurucu ekiple iletişime geçerek işletmenizi tanımlatın.
        </p>
      ) : (
        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
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