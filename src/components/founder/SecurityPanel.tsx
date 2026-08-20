import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { KeyRound, ShieldCheck, ShieldOff, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getFounderSecurity, regenerateBackupCodes } from "@/lib/security.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Factor = { id: string; status: string; friendly_name?: string | undefined };

export function SecurityPanel() {
  const fetchSecurity = useServerFn(getFounderSecurity);
  const regenerate = useServerFn(regenerateBackupCodes);

  const [factors, setFactors] = useState<Factor[]>([]);
  const [enrolling, setEnrolling] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);

  const security = useQuery({ queryKey: ["founder-security"], queryFn: () => fetchSecurity() });

  async function refreshFactors() {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors((data?.totp ?? []) as Factor[]);
  }

  useEffect(() => {
    void refreshFactors();
  }, []);

  const verified = factors.find((factor) => factor.status === "verified") ?? null;

  async function startEnroll() {
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Kurucu ${new Date().toISOString().slice(0, 10)}`,
      });
      if (error) throw error;
      setEnrolling({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kurulum başlatılamadı.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnroll(event: React.FormEvent) {
    event.preventDefault();
    if (!enrolling) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: enrolling.id,
        code: code.trim(),
      });
      if (error) throw error;
      toast.success("İki adımlı doğrulama etkinleştirildi.");
      setEnrolling(null);
      setCode("");
      await refreshFactors();
      backupMutation.mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kod doğrulanamadı.");
    } finally {
      setBusy(false);
    }
  }

  async function disable(factorId: string) {
    setBusy(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      toast.success("İki adımlı doğrulama kapatıldı.");
      await refreshFactors();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kapatılamadı.");
    } finally {
      setBusy(false);
    }
  }

  const backupMutation = useMutation({
    mutationFn: () => regenerate(),
    onSuccess: (result) => {
      setCodes(result.codes);
      toast.success("Yeni yedek kodlar oluşturuldu. Güvenli bir yere kaydedin.");
      void security.refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-border bg-card p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-warm text-warm-foreground">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <h2 className="text-xl">İki adımlı doğrulama (2FA)</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Kurucu girişinde şifreden sonra doğrulama uygulamanızdaki (Google Authenticator, 1Password,
              Authy) 6 haneli kod istenir.
            </p>
          </div>
        </div>

        {verified ? (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-muted/40 p-4">
            <p className="text-sm">
              Durum: <span className="font-semibold text-primary">Etkin</span>
            </p>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              disabled={busy}
              onClick={() => void disable(verified.id)}
            >
              <ShieldOff className="size-4" /> 2FA'yı kapat
            </Button>
          </div>
        ) : enrolling ? (
          <form onSubmit={(event) => void confirmEnroll(event)} className="mt-5 space-y-4">
            <div className="flex flex-col items-start gap-4 sm:flex-row">
              <img
                src={enrolling.qr}
                alt="2FA kurulum QR kodu"
                className="size-40 rounded-2xl border border-border bg-white p-2"
              />
              <div className="space-y-2 text-sm">
                <p className="text-muted-foreground">
                  QR kodu okutun veya bu anahtarı elle girin:
                </p>
                <code className="block break-all rounded-xl bg-muted px-3 py-2 text-xs">
                  {enrolling.secret}
                </code>
              </div>
            </div>
            <div className="max-w-xs space-y-2">
              <Label htmlFor="enroll-code">Uygulamadaki 6 haneli kod</Label>
              <Input
                id="enroll-code"
                inputMode="numeric"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                required
                className="rounded-xl tracking-widest"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="rounded-full" disabled={busy}>
                Doğrula ve etkinleştir
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="rounded-full"
                onClick={() => setEnrolling(null)}
              >
                İptal
              </Button>
            </div>
          </form>
        ) : (
          <Button className="mt-5 rounded-full" disabled={busy} onClick={() => void startEnroll()}>
            <ShieldCheck className="size-4" /> 2FA'yı etkinleştir
          </Button>
        )}
      </div>

      <div className="rounded-3xl border border-border bg-card p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-warm text-warm-foreground">
            <KeyRound className="size-5" />
          </span>
          <div>
            <h2 className="text-xl">Yedek kodlar</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Telefonunuza erişemediğinizde her kod bir kez kullanılabilir. Kalan kod:{" "}
              <span className="font-semibold">{security.data?.remaining ?? 0}</span> /{" "}
              {security.data?.total ?? 0}
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          className="mt-5 rounded-full"
          disabled={backupMutation.isPending}
          onClick={() => backupMutation.mutate()}
        >
          <RefreshCw className="size-4" />{" "}
          {backupMutation.isPending ? "Oluşturuluyor…" : "Yeni yedek kod seti üret"}
        </Button>

        {codes ? (
          <div className="mt-5 rounded-2xl border border-border/70 bg-muted/40 p-4">
            <p className="text-sm font-medium">
              Bu kodlar yalnızca şimdi görüntülenir — kopyalayıp güvenli bir yerde saklayın.
            </p>
            <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm sm:grid-cols-3">
              {codes.map((item) => (
                <li key={item} className="rounded-lg bg-card px-3 py-2 text-center">
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={() => {
                  void navigator.clipboard.writeText(codes.join("\n"));
                  toast.success("Kodlar kopyalandı");
                }}
              >
                Kopyala
              </Button>
              <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setCodes(null)}>
                Gizle
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
