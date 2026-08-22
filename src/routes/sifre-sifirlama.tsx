import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/sifre-sifirlama")({
  head: () => ({
    meta: [
      { title: "Şifre Sıfırlama — SİLVAN CEBİMDE" },
      {
        name: "description",
        content: "SİLVAN CEBİMDE hesabınız için yeni bir şifre belirleyin.",
      },
      { property: "og:title", content: "Şifre Sıfırlama — SİLVAN CEBİMDE" },
      { property: "og:description", content: "Yeni şifrenizi güvenle belirleyin." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  // Kurtarma bağlantısı bir oturum açar; sadece o durumda şifre değiştirilebilir.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      toast.error("Şifreler eşleşmiyor.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Şifreniz güncellendi. Şimdi giriş yapabilirsiniz.");
      await supabase.auth.signOut();
      navigate({ to: "/auth", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Şifre güncellenemedi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-warm/40 px-4 py-16">
      <div className="w-full max-w-md">
        <div className="text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-3xl bg-gradient-warm text-primary-foreground shadow-glow">
            <KeyRound className="size-6" />
          </span>
          <h1 className="mt-5 text-3xl">Yeni şifre belirle</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Şifre en az 8 karakter olmalı ve daha önce kullanmadığınız bir şifre olmalıdır.
          </p>
        </div>

        {ready ? (
          <form
            onSubmit={(event) => void handleSubmit(event)}
            className="mt-8 space-y-4 rounded-3xl border border-border/70 bg-card p-6 shadow-card"
          >
            <div className="space-y-2">
              <Label htmlFor="new-password">Yeni şifre</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Yeni şifre (tekrar)</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                className="rounded-xl"
              />
            </div>
            <Button type="submit" size="lg" disabled={busy} className="w-full rounded-full">
              <ShieldCheck className="size-4" /> {busy ? "Kaydediliyor…" : "Şifreyi güncelle"}
            </Button>
          </form>
        ) : (
          <div className="mt-8 rounded-3xl border border-border/70 bg-card p-6 text-sm text-muted-foreground shadow-card">
            Bu sayfayı e-postanızdaki sıfırlama bağlantısı üzerinden açmanız gerekiyor. Bağlantı
            süresi dolduysa giriş ekranından yeni bir bağlantı isteyin.
          </div>
        )}

        <div className="mt-5 flex justify-center gap-4 text-sm">
          <Link to="/kurucu-giris" className="text-muted-foreground underline-offset-4 hover:underline">
            Kurucu girişi
          </Link>
          <Link to="/" className="text-muted-foreground underline-offset-4 hover:underline">
            Siteye dön
          </Link>
        </div>
      </div>
    </div>
  );
}
