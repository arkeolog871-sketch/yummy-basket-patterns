import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  /** Yeni kullanıcı oluşturulmasına izin verilsin mi (kurucu girişinde kapalı). */
  allowSignUp?: boolean;
  idPrefix?: string;
  initialEmail?: string;
  onVerified?: (userId: string, email: string) => Promise<void> | void;
  onFailed?: (email: string, message: string) => void;
};

/** E-posta ile tek kullanımlık doğrulama kodu (OTP) girişi. */
export function EmailCodeLogin({
  allowSignUp = true,
  idPrefix = "otp",
  initialEmail = "",
  onVerified,
  onFailed,
}: Props) {
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function sendCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: allowSignUp,
          emailRedirectTo: `${window.location.origin}/`,
        },
      });
      if (error) throw error;
      setSent(true);
      toast.success("Doğrulama kodu e-postanıza gönderildi.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Kod gönderilemedi.";
      onFailed?.(email.trim(), message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim().replace(/\s/g, ""),
        type: "email",
      });
      if (error) throw error;
      const signedIn = data.user;
      if (!signedIn) throw new Error("Oturum açılamadı.");
      await onVerified?.(signedIn.id, signedIn.email ?? email.trim());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Kod doğrulanamadı.";
      onFailed?.(email.trim(), message);
      toast.error(message);
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void (sent ? verify(event) : sendCode(event))}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-email`}>E-posta</Label>
        <Input
          id={`${idPrefix}-email`}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={sent}
          required
          className="rounded-xl"
        />
      </div>

      {sent ? (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-code`}>E-posta doğrulama kodu</Label>
          <Input
            id={`${idPrefix}-code`}
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="123456"
            required
            className="rounded-xl tracking-widest"
          />
          <p className="text-xs text-muted-foreground">
            Kod 6 hanelidir ve kısa süre geçerlidir. E-postadaki bağlantıya da tıklayabilirsiniz.
          </p>
        </div>
      ) : null}

      <Button type="submit" size="lg" disabled={busy} className="w-full rounded-full">
        {sent ? <KeyRound className="size-4" /> : <MailCheck className="size-4" />}
        {busy ? "İşleniyor…" : sent ? "Kodu doğrula ve giriş yap" : "Doğrulama kodu gönder"}
      </Button>

      {sent ? (
        <div className="flex justify-between text-sm">
          <button
            type="button"
            className="text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => {
              setSent(false);
              setCode("");
            }}
          >
            E-postayı değiştir
          </button>
          <button
            type="button"
            className="text-muted-foreground underline-offset-4 hover:underline"
            disabled={busy}
            onClick={(event) => void sendCode(event)}
          >
            Kodu yeniden gönder
          </button>
        </div>
      ) : null}
    </form>
  );
}