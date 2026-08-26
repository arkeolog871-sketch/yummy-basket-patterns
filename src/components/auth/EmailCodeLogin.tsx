import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { KeyRound, MailCheck } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { sendEmailVerificationCode, verifyEmailVerificationCode } from "@/lib/otp.functions";
import {
  OTP_CODE_LENGTH,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_TTL_MINUTES,
  isCompleteOtpCode,
  parseExactOtpCode,
} from "@/lib/otp";
import { OtpCodeInput } from "@/components/auth/OtpCodeInput";
import { LegalConsentCheckbox } from "@/components/legal/LegalConsentCheckbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TERMS_ACCEPTANCE_REQUIRED } from "@/lib/legal";

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
  allowSignUp = false,
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
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(startAtCode ? OTP_RESEND_COOLDOWN_SECONDS : 0);
  const submittingRef = useRef(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const termsAcceptedRef = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function sendCode(event?: React.FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await requestCode({
        data: {
          email: email.trim(),
          allowSignUp,
          purpose: startAtCode ? "signup" : "login",
        },
      });
      if (!result.ok) {
        onFailed?.(email.trim(), result.error);
        setError(result.error);
        toast.error(result.error);
        if (result.retryAfterSeconds) setCooldown(result.retryAfterSeconds);
        return;
      }
      setSent(true);
      setCode("");
      setCooldown(result.cooldownSeconds);
      toast.success("6 haneli doğrulama kodu e-postanıza gönderildi.");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Kod gönderilemedi.";
      onFailed?.(email.trim(), message);
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function verify(rawCode?: string) {
    const token = parseExactOtpCode(rawCode ?? code);
    if (!token || submittingRef.current) return;
    if (!termsAcceptedRef.current) {
      setError(TERMS_ACCEPTANCE_REQUIRED);
      return;
    }
    submittingRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await verifyServerCode({
        data: { email: email.trim(), code: token, termsAccepted: true },
      });
      if (!result.ok) {
        onFailed?.(email.trim(), result.error);
        setError(result.error);
        toast.error(result.error);
        setCode("");
        return;
      }
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
      });
      if (sessionError) throw new Error(sessionError.message);
      await onVerified?.(result.userId, email.trim());
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Kod doğrulanamadı.";
      onFailed?.(email.trim(), message);
      setError(message);
      toast.error(message);
      setCode("");
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  }

  const canVerify = isCompleteOtpCode(code) && termsAccepted;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void (sent ? verify() : sendCode());
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-email`}>E-posta</Label>
        <Input
          id={`${idPrefix}-email`}
          name="email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          inputMode="email"
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
          <OtpCodeInput
            id={`${idPrefix}-code`}
            value={code}
            disabled={busy}
            autoFocus
            onChange={(next) => {
              setCode(next);
              setError(null);
            }}
            onComplete={(next) => {
              if (!termsAcceptedRef.current) return;
              void verify(next);
            }}
          />
          <LegalConsentCheckbox
            id={`${idPrefix}-terms`}
            checked={termsAccepted}
            disabled={busy}
            onCheckedChange={(next) => {
              setTermsAccepted(next);
              termsAcceptedRef.current = next;
              setError(null);
              if (next && isCompleteOtpCode(code)) void verify(code);
            }}
          />
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Kod {OTP_CODE_LENGTH} hanelidir ve {OTP_TTL_MINUTES} dakika geçerlidir.
              Yapıştırabilirsiniz; yalnızca rakam kabul edilir. {OTP_CODE_LENGTH} hane dolunca
              otomatik doğrulanır.
            </p>
          )}
        </div>
      ) : null}

      <Button
        type="submit"
        size="lg"
        disabled={busy || (sent && !canVerify)}
        className="w-full rounded-full"
      >
        {sent ? <KeyRound className="size-4" /> : <MailCheck className="size-4" />}
        {busy ? "İşleniyor…" : sent ? "Doğrula" : "Doğrulama kodu gönder"}
      </Button>

      {sent ? (
        <div className="flex justify-between text-sm">
          <button
            type="button"
            className="text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => {
              setSent(false);
              setCode("");
              setError(null);
              setTermsAccepted(false);
              termsAcceptedRef.current = false;
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
            {cooldown > 0 ? `Kodu Tekrar Gönder (${cooldown}s)` : "Kodu Tekrar Gönder"}
          </button>
        </div>
      ) : null}
    </form>
  );
}
