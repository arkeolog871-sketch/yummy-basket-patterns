import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { requestVendorLoginCode, verifyVendorLoginCode } from "@/lib/vendor-auth.functions";
import { OTP_RESEND_COOLDOWN_SECONDS, isCompleteOtpCode, parseExactOtpCode } from "@/lib/otp";
import { TERMS_ACCEPTANCE_REQUIRED } from "@/lib/legal";
import { OtpCodeInput } from "@/components/auth/OtpCodeInput";
import { LegalConsentCheckbox } from "@/components/legal/LegalConsentCheckbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** İşletme girişi: telefon numarası veya kayıtlı e-posta + tek kullanımlık kod. */
export function VendorPhoneLogin() {
  const requestCode = useServerFn(requestVendorLoginCode);
  const verifyCode = useServerFn(verifyVendorLoginCode);
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const submittingRef = useRef(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const termsAcceptedRef = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function send(event?: React.FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await requestCode({ data: { identifier } });
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        if (result.retryAfterSeconds) setCooldown(result.retryAfterSeconds);
        return;
      }
      setMaskedEmail(result.maskedEmail);
      setCode("");
      setCooldown(result.cooldownSeconds ?? OTP_RESEND_COOLDOWN_SECONDS);
      toast.success("6 haneli doğrulama kodu e-postanıza gönderildi.");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Kod gönderilemedi.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function verify(rawCode?: string) {
    const digits = parseExactOtpCode(rawCode ?? code);
    if (!digits || submittingRef.current) return;
    if (!termsAcceptedRef.current) {
      setError(TERMS_ACCEPTANCE_REQUIRED);
      return;
    }
    submittingRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const tokens = await verifyCode({ data: { identifier, code: digits, termsAccepted: true } });
      if (!tokens.ok) {
        throw new Error(tokens.error);
      }
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      });
      if (sessionError) throw new Error(sessionError.message);
      toast.success("Giriş başarılı!");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Kod doğrulanamadı.";
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
        void (maskedEmail ? verify() : send());
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="vendor-phone">İşletme telefonu veya e-postası</Label>
        <Input
          id="vendor-phone"
          name="username"
          type="text"
          autoComplete="username"
          placeholder="05xx xxx xx xx veya ornek@eposta.com"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          disabled={Boolean(maskedEmail)}
          required
          className="rounded-xl"
        />
        <p className="text-xs text-muted-foreground">
          Kayıt sırasında girilen e-posta, müşteri girişindeki hesabınızla aynıdır; ikisiyle de kod
          alabilirsiniz.
        </p>
      </div>

      {maskedEmail ? (
        <div className="space-y-2">
          <Label htmlFor="vendor-code">E-posta doğrulama kodu</Label>
          <OtpCodeInput
            id="vendor-code"
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
            id="vendor-terms"
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
              Kod, işletme hesabınıza kayıtlı e-posta adresine gönderildi. 6 haneyi yazın veya
              yapıştırın; yalnızca rakam kabul edilir.
            </p>
          )}
        </div>
      ) : null}

      <Button
        type="submit"
        size="lg"
        disabled={busy || (Boolean(maskedEmail) && !canVerify)}
        className="w-full rounded-full"
      >
        {maskedEmail ? <KeyRound className="size-4" /> : <Smartphone className="size-4" />}
        {busy ? "İşleniyor…" : maskedEmail ? "Doğrula" : "Doğrulama kodu gönder"}
      </Button>

      {maskedEmail ? (
        <div className="flex justify-between text-sm">
          <button
            type="button"
            className="text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => {
              setMaskedEmail(null);
              setCode("");
              setError(null);
              setTermsAccepted(false);
              termsAcceptedRef.current = false;
            }}
          >
            Bilgiyi değiştir
          </button>
          <button
            type="button"
            className="text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
            disabled={busy || cooldown > 0}
            onClick={() => void send()}
          >
            {cooldown > 0 ? `Kodu Tekrar Gönder (${cooldown}s)` : "Kodu Tekrar Gönder"}
          </button>
        </div>
      ) : null}
    </form>
  );
}
