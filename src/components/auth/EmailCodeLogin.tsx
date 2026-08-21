import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, MailCheck } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  sendEmailVerificationCode,
  verifyEmailVerificationCode,
} from "@/lib/otp.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  /** Yeni kullanıcı oluşturulmasına izin verilsin mi (kurucu girişinde kapalı). */
  allowSignUp?: boolean;
  idPrefix?: string;
  initialEmail?: string;
  /** Kayıt sonrası doğrulama ekranıyla başlanması için. */
  startAtCode?: boolean;
  onVerified?: (userId: string, email: string) => Promise<void> | void;
  onFailed?: (email: string, message: string) => void;
};

/** E-posta ile 6 haneli doğrulama kodu (OTP) girişi/doğrulaması. */
export function EmailCodeLogin({
  allowSignUp = true,
  idPrefix = "otp",
  initialEmail = "",
  startAtCode = false,
  onVerified,
  onFailed,
}: Props) {
  const requestCode = useServerFn(sendEmailVerificationCode);
  const verifyServerCode = useServerFn(verifyEmailVerificationCode);
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(startAtCode);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(startAtCode ? 60 : 0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function sendCode(event?: React.FormEvent) {
    event?.preventDefault();
    setBusy(true);
    try {
      const result = await requestCode({
        data: { email: email.trim(), allowSignUp },
      });
      if (!result.ok) {
        onFailed?.(email.trim(), result.error);
        toast.error(result.error);
        return;
      }
      setSent(true);
      setCooldown(result.cooldownSeconds);
      toast.success("6 haneli doğrulama kodu e-postanıza gönderildi.");
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
      const result = await verifyServerCode({
        data: { email: email.trim(), code },
      });
      if (!result.ok) {
        onFailed?.(email.trim(), result.error);
        toast.error(result.error);
        setCode("");
        return;
      }
      const { error } = await supabase.auth.setSession({
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
      });
      if (error) throw new Error(error.message);
      await onVerified?.(result.userId, email.trim());
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
            maxLength={6}
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="123456"
            required
            className="rounded-xl tracking-widest"
          />
          <p className="text-xs text-muted-foreground">
            Kod 6 hanelidir ve 10 dakika geçerlidir. 5 hatalı denemeden sonra yeni kod istemeniz
            gerekir.
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
            className="text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
            disabled={busy || cooldown > 0}
            onClick={() => void sendCode()}
          >
            {cooldown > 0 ? `Yeni kod gönder (${cooldown}s)` : "Yeni kod gönder"}
          </button>
        </div>
      ) : null}
    </form>
  );
}
