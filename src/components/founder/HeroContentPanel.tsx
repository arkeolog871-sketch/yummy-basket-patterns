import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Save, RotateCcw } from "lucide-react";
import { useSiteSettings, DEFAULT_HERO, type HeroContent } from "@/hooks/useSiteSettings";
import { updateHeroContent } from "@/lib/founder.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function HeroContentPanel() {
  const { hero, refresh } = useSiteSettings();
  const save = useServerFn(updateHeroContent);
  const [form, setForm] = useState<HeroContent>(hero);

  useEffect(() => setForm(hero), [hero]);

  const mutation = useMutation({
    mutationFn: (values: HeroContent) => save({ data: values }),
    onSuccess: () => {
      toast.success("Ana sayfa metinleri güncellendi");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function field(key: keyof HeroContent, label: string, hint: string) {
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
      <h2 className="text-xl">Ana sayfa tanıtım metinleri</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Ana sayfanın üst alanındaki etiket, başlık ve açıklama yazılarını buradan düzenleyin.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {field("hero_badge", "Üst etiket", "İşletme sayısı otomatik eklenir. Örn: “işletme, dakikalar içinde kapınızda”")}
        {field("hero_title", "Başlık", "Örn: “Mahalleniz hazır,”")}
        {field("hero_title_accent", "Vurgulu başlık", "Renkli görünen kısım. Boş bırakabilirsiniz.")}
        {field("hero_subtitle", "Açıklama", "Başlığın altındaki kısa tanıtım cümlesi.")}
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-gradient-hero p-5">
        <span className="inline-flex items-center rounded-full bg-background/70 px-3 py-1 text-xs font-semibold text-muted-foreground">
          8 {form.hero_badge}
        </span>
        <h3 className="mt-3 text-2xl leading-tight">
          {form.hero_title} <span className="text-accent">{form.hero_title_accent}</span>
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">{form.hero_subtitle}</p>
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
        <Button variant="outline" className="rounded-full" onClick={() => setForm(DEFAULT_HERO)}>
          <RotateCcw className="size-4" />
          Varsayılana dön
        </Button>
      </div>
    </div>
  );
}