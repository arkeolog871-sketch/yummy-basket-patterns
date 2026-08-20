import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { requestVendorLoginCode, verifyVendorLoginCode } from "@/lib/vendor-auth.functions";
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

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await requestCode({ data: { identifier } });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setMaskedEmail(result.maskedEmail);
      toast.success("Tek kullanımlık kod gönderildi.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kod gönderilemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const tokens = await verifyVendorSession();
      if (tokens) toast.success("Giriş başarılı!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kod doğrulanamadı.");
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  async function verifyVendorSession() {
    const tokens = await verifyCode({ data: { identifier, code } });
    if (!tokens.ok) {
      throw new Error(tokens.error);
    }
    const { error } = await supabase.auth.setSession({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    });
    if (error) throw new Error(error.message);
    return tokens;
  }

  return (
    <form
      onSubmit={(event) => void (maskedEmail ? verify(event) : send(event))}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="vendor-phone">İşletme telefonu veya e-postası</Label>
        <Input
          id="vendor-phone"
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
          <Label htmlFor="vendor-code">Tek kullanımlık şifre</Label>
          <Input
            id="vendor-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            required
            className="rounded-xl tracking-widest"
          />
          <p className="text-xs text-muted-foreground">
            Kod, işletme hesabınızın kayıtlı e-posta adresine ({maskedEmail}) gönderildi. Kod 6
            hanelidir ve kısa süre geçerlidir.
          </p>
        </div>
      ) : null}

      <Button type="submit" size="lg" disabled={busy} className="w-full rounded-full">
        {maskedEmail ? <KeyRound className="size-4" /> : <Smartphone className="size-4" />}
        {busy
          ? "İşleniyor…"
          : maskedEmail
            ? "Kodu doğrula ve giriş yap"
            : "Tek kullanımlık şifre gönder"}
      </Button>

      {maskedEmail ? (
        <div className="flex justify-between text-sm">
          <button
            type="button"
            className="text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => {
              setMaskedEmail(null);
              setCode("");
            }}
          >
            Bilgiyi değiştir
          </button>
          <button
            type="button"
            className="text-muted-foreground underline-offset-4 hover:underline"
            disabled={busy}
            onClick={(event) => void send(event)}
          >
            Kodu yeniden gönder
          </button>
        </div>
      ) : null}
    </form>
  );
}