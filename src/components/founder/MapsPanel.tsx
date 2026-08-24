import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toPublicErrorMessage } from "@/lib/public-error";
import { Save, Lock, Map, Copy, ExternalLink } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { getMapsAdminConfig, updateMapsConfig } from "@/lib/maps.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function currentHost() {
  if (typeof window === "undefined") return "";
  return window.location.hostname;
}

function suggestedReferrers(host: string) {
  if (!host) return "";
  const parts = host.split(".");
  const root = parts.length > 2 ? parts.slice(-2).join(".") : host;
  return `https://${root}/*\nhttps://*.${root}/*`;
}

export function MapsPanel() {
  const { settings, refresh, isFounder } = useSiteSettings();
  const save = useServerFn(updateMapsConfig);
  const loadConfig = useServerFn(getMapsAdminConfig);
  const config = useQuery({
    queryKey: ["maps-admin-config"],
    enabled: isFounder,
    queryFn: () => loadConfig(),
  });
  const [apiKey, setApiKey] = useState("");
  const [referrers, setReferrers] = useState("");
  const [host, setHost] = useState("");

  useEffect(() => {
    setReferrers(config.data?.allowedReferrers ?? "");
  }, [config.data?.allowedReferrers]);

  useEffect(() => setHost(currentHost()), []);

  const mutation = useMutation({
    mutationFn: (values: { api_key: string; allowed_referrers: string }) =>
      save({ data: values }),
    onSuccess: () => {
      toast.success("Harita ayarları kaydedildi. Sayfayı yenileyin.");
      refresh();
      void config.refetch();
    },
    onError: (error: Error) => toast.error(toPublicErrorMessage(error)),
  });

  if (!isFounder) {
    return (
      <div className="rounded-3xl border border-border bg-card p-6">
        <h2 className="flex items-center gap-2 text-xl">
          <Lock className="size-5 text-muted-foreground" /> Yetkiniz yok
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Harita ayarlarını yalnızca kurucu rolüne sahip hesaplar düzenleyebilir.
        </p>
      </div>
    );
  }

  const suggestion = suggestedReferrers(host);

  return (
    <div className="rounded-3xl border border-border bg-card p-6">
      <h2 className="flex items-center gap-2 text-xl">
        <Map className="size-5 text-primary" /> Google Haritalar ayarları
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Kendi alan adınızda haritaların çalışması için Google Cloud'da oluşturduğunuz tarayıcı
        (browser) API anahtarını buraya girin. Anahtar boş bırakılırsa Lovable'ın yönetilen anahtarı
        kullanılır ve haritalar yalnızca <code className="rounded bg-muted px-1">*.lovable.app</code>{" "}
        adreslerinde açılır.
      </p>

      <div className="mt-5 grid gap-4">
        <label className="block">
          <span className="text-sm font-semibold">Google Maps tarayıcı API anahtarı</span>
          <Input
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={config.data?.hasKey ? `Kayıtlı: ${config.data.maskedKey}` : "AIza..."}
            spellCheck={false}
            autoComplete="off"
            className="mt-1.5 rounded-xl font-mono"
          />
          <span className="mt-1 block text-xs text-muted-foreground">
            Tarayıcı anahtarları herkese görünür; güvenliği referrer (yönlendiren alan adı)
            kısıtlamasıyla sağlanır. Sunucu anahtarınızı buraya girmeyin.
          </span>
        </label>

        <label className="block">
          <span className="text-sm font-semibold">İzin verilecek referrer kısıtlamaları</span>
          <Textarea
            value={referrers}
            onChange={(event) => setReferrers(event.target.value)}
            rows={4}
            spellCheck={false}
            placeholder={suggestion || "https://ornek.com/*"}
            className="mt-1.5 rounded-xl font-mono text-sm"
          />
          <span className="mt-1 block text-xs text-muted-foreground">
            Bu listeyi Google Cloud Console → Kimlik bilgileri → anahtarınız → “Uygulama
            kısıtlamaları: HTTP yönlendirenler” alanına aynen yapıştırın. Burada tutulması yalnızca
            kayıt amaçlıdır.
          </span>
        </label>

        {suggestion ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-4">
            <p className="text-sm font-semibold">Bu alan adı için önerilen kısıtlamalar</p>
            <pre className="mt-2 whitespace-pre-wrap break-all text-xs text-muted-foreground">
              {suggestion}
            </pre>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => setReferrers(suggestion)}
              >
                <Copy className="size-4" /> Alana doldur
              </Button>
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
              >
                <ExternalLink className="size-3.5" /> Google Cloud kimlik bilgileri
              </a>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          className="rounded-full"
          disabled={mutation.isPending}
          onClick={() =>
            mutation.mutate({
              api_key: apiKey.trim(),
              allowed_referrers: referrers.trim(),
            })
          }
        >
          <Save className="size-4" />
          {mutation.isPending ? "Kaydediliyor…" : "Kaydet"}
        </Button>
        <Button
          variant="outline"
          className="rounded-full"
          disabled={mutation.isPending}
          onClick={() => {
            setApiKey("");
            mutation.mutate({ api_key: "", allowed_referrers: referrers.trim() });
          }}
        >
          Anahtarı temizle
        </Button>
      </div>

      <ol className="mt-6 list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
        <li>Google Cloud'da bir proje açın ve faturalandırmayı etkinleştirin.</li>
        <li>“Maps JavaScript API”yi (ve kullandığınız diğer Maps API'lerini) etkinleştirin.</li>
        <li>Kimlik bilgileri sayfasından yeni bir API anahtarı oluşturun.</li>
        <li>Anahtara yukarıdaki referrer kısıtlamalarını ekleyin.</li>
        <li>Anahtarı bu ekrana yapıştırıp kaydedin.</li>
      </ol>
    </div>
  );
}

export default MapsPanel;
