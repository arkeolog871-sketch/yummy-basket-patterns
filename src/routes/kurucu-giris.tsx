import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Crown, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logFounderLoginAttempt } from "@/lib/audit.functions";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/kurucu-giris")({
  head: () => ({
    meta: [
      { title: "Kurucu Girişi — SofraKapımda" },
      {
        name: "description",
        content: "SofraKapımda kurucu yönetim portalına güvenli giriş.",
      },
      { property: "og:title", content: "Kurucu Girişi — SofraKapımda" },
      { property: "og:description", content: "Kurucu yönetim portalı girişi." },
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

function FounderLoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);

  // Zaten oturumu olan bir kurucu doğrudan panele gider.
  useEffect(() => {
    if (loading || !user) return;
    let active = true;
    setChecking(true);
    void readFounderState(user.id)
      .then((state) => {
        if (!active) return;
        if (state.isFounder || !state.founderExists) {
          navigate({ to: "/kurucu", replace: true });
        }
      })
      .catch(() => {})
      .finally(() => active && setChecking(false));
    return () => {
      active = false;
    };
  }, [user, loading, navigate]);

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

      const state = await readFounderState(signedIn.id);
      if (!state.isFounder && state.founderExists) {
        void logFounderLoginAttempt({
          data: {
            email,
            status: "denied",
            reason: "Kurucu yetkisi yok",
            userId: signedIn.id,
          },
        }).catch(() => {});
        await supabase.auth.signOut();
        toast.error("Bu hesabın kurucu yetkisi yok.");
        return;
      }
      void logFounderLoginAttempt({
        data: { email, status: "success", userId: signedIn.id },
      }).catch(() => {});
      toast.success(state.isFounder ? "Kurucu paneline hoş geldiniz" : "Kurucu profili tanımlanabilir");
      navigate({ to: "/kurucu", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Giriş yapılamadı.");
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
          <h1 className="mt-5 text-3xl">Kurucu girişi</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Bu portal yalnızca kurucu hesabı içindir ve normal kullanıcı girişinden bağımsızdır.
          </p>
        </div>

        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="mt-8 space-y-4 rounded-3xl border border-border/70 bg-card p-6 shadow-card"
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
          <Button
            type="submit"
            size="lg"
            disabled={busy || checking}
            className="w-full rounded-full"
          >
            <Lock className="size-4" /> {busy ? "Doğrulanıyor…" : "Kurucu olarak giriş yap"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Yetkisiz hesaplarla yapılan girişler otomatik olarak kapatılır.
          </p>
        </form>

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
