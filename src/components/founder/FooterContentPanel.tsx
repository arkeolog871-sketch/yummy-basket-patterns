import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toPublicErrorMessage } from "@/lib/public-error";
import { Save, RotateCcw, Lock } from "lucide-react";
import { useSiteSettings, DEFAULT_FOOTER, type FooterContent } from "@/hooks/useSiteSettings";
import { updateFooterContent } from "@/lib/founder.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function FooterContentPanel() {
  const { footer, refresh, isFounder } = useSiteSettings();
  const save = useServerFn(updateFooterContent);
  const [form, setForm] = useState<FooterContent>(footer);

  useEffect(() => setForm(footer), [footer]);

  const mutation = useMutation({
    mutationFn: (values: FooterContent) => save({ data: values }),
    onSuccess: () => {
      toast.success("Alt bilgi metinleri güncellendi");
      refresh();
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
          Alt bilgi metinlerini yalnızca sayfa yöneticisi rolüne sahip hesaplar düzenleyebilir.
        </p>
      </div>
    );
  }

  function field(key: keyof FooterContent, label: string, hint: string) {
    return (
      <label className="block">
        <span className="text-sm font-semibold">{label}</span>
        <Input
          value={form[key]}
          onChange={(event) => setForm({ ...form, [key]: event.target.value })}
          className="mt-1.5 rounded-xl"
        />
        <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>
      </label>
    );
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-6">
      <h2 className="text-xl">Alt bilgi (footer)</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Sitenin her sayfasının altında görünen tanıtım cümlesi ve teslimat saatleri metnini buradan
        düzenleyin.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {field(
          "footer_tagline",
          "Tanıtım cümlesi",
          "Marka adının altında gösterilir. Örn: “Mahallenin en iyi ustalarından sıcak yemekler, kapınıza kadar.”",
        )}
        {field(
          "footer_delivery_hours",
          "Teslimat saatleri",
          "“Teslimat saatleri” başlığı altında gösterilir. Örn: “Her gün 10:00 – 23:30”",
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          className="rounded-full"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate(form)}
        >
          <Save className="size-4" />
          {mutation.isPending ? "Kaydediliyor…" : "Kaydet"}
        </Button>
        <Button variant="outline" className="rounded-full" onClick={() => setForm(DEFAULT_FOOTER)}>
          <RotateCcw className="size-4" />
          Varsayılana dön
        </Button>
      </div>
    </div>
  );
}
