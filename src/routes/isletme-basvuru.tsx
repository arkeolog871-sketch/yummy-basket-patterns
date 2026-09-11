import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Store } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { EmailCodeLogin } from "@/components/auth/EmailCodeLogin";
import { startAppleOAuth, humanizeOAuthError as humanizeAppleOAuthError } from "@/lib/apple-oauth";

import { useAppCategories } from "@/hooks/useTaxonomy";
import { slugify, formatDateTime } from "@/lib/format";
import { toPublicErrorMessage } from "@/lib/public-error";
import { LATITUDE_FIELD_PLACEHOLDER, LONGITUDE_FIELD_PLACEHOLDER } from "@/lib/location";
import {
  submitBusinessApplication,
  listMyBusinessApplications,
} from "@/lib/business-applications.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/isletme-basvuru")({
  head: () => ({
    meta: [
      { title: "İşletme Başvurusu — SİLVAN CEBİMDE" },
      {
        name: "description",
        content:
          "İşletmenizi SİLVAN CEBİMDE'de yayınlamak için başvuru formunu doldurun; kurucu onayından sonra vitrinde yer alın.",
      },
      { property: "og:title", content: "İşletme Başvurusu — SİLVAN CEBİMDE" },
      {
        property: "og:description",
        content: "İşletmenizi platforma eklemek için başvurunuzu gönderin.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BusinessApplicationGate,
});

/**
 * Başvuru sayfasına girişte kimlik doğrulama: mevcut e-posta kodu (OTP) ve Apple
 * akışları yeniden kullanılır; doğrulanınca asıl form açılır.
 */
function BusinessApplicationGate() {
  const { user, loading } = useAuth();
  const verified = Boolean(user && user.email_confirmed_at);

  async function handleApple() {
    try {
      const result = await startAppleOAuth();
      if (!result.ok) toast.error(humanizeAppleOAuthError(result.error));
    } catch (error) {
      toast.error(
        humanizeAppleOAuthError(
          error instanceof Error ? error.message : "Apple girişi başlatılamadı.",
        ),
      );
    }
  }

  if (loading) {
    return <p className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted-foreground">Yükleniyor…</p>;
  }

  if (!verified) {
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <header className="mb-6 text-center">
          <p className="inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-accent">
            <Store className="size-4" /> İşletme başvurusu
          </p>
          <h1 className="mt-3 text-2xl font-semibold">Önce kimliğinizi doğrulayın</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            E-posta kodu veya Apple ile doğrulandıktan sonra başvuru formu açılır.
          </p>
        </header>

        <div className="space-y-4 rounded-3xl border border-border bg-card p-5">
          <EmailCodeLogin
            idPrefix="application-otp"
            allowSignUp
            onVerified={() => {
              toast.success("Doğrulama başarılı, formu doldurabilirsiniz.");
            }}

          />
          <div className="border-t border-border/70 pt-4">
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-full"
              onClick={() => void handleApple()}
            >
              Apple ile devam et
            </Button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Apple ile doğrulama tamamlandıktan sonra bu sayfaya geri dönüp başvurunuzu
              gönderebilirsiniz.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <BusinessApplicationPage />;
}


const STATUS_LABELS: Record<string, string> = {
  pending: "İnceleniyor",
  approved: "Onaylandı",
  rejected: "Reddedildi",
};

const emptyForm = {
  name: "",
  slug: "",
  tagline: "",
  sector: "",
  category: "",
  cuisines: "",
  delivery_minutes: "30",
  delivery_fee: "0",
  min_order: "0",
  cover_image_url: "",
  address: "",
  district: "",
  city: "",
  latitude: "",
  longitude: "",
  maps_url: "",
  contact_email: "",
  contact_phone: "",
  contact_person: "",
  opens_at: "09:00",
  closes_at: "22:00",
  is_open_manual: true,
};

function BusinessApplicationPage() {
  const submit = useServerFn(submitBusinessApplication);
  const fetchMine = useServerFn(listMyBusinessApplications);
  const queryClient = useQueryClient();
  const { categories } = useAppCategories();
  const [form, setForm] = useState(emptyForm);

  const mine = useQuery({
    queryKey: ["my-business-applications"],
    queryFn: () => fetchMine(),
  });

  const activeSector = form.sector || categories[0]?.slug || "";

  const submitMutation = useMutation({
    mutationFn: () =>
      submit({
        data: {
          slug: form.slug,
          name: form.name.trim(),
          tagline: form.tagline.trim(),
          category: form.category.trim(),
          sector: activeSector,
          cuisines: form.cuisines
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          delivery_minutes: Number(form.delivery_minutes),
          delivery_fee: Number(form.delivery_fee),
          min_order: Number(form.min_order),
          cover_image_url: form.cover_image_url.trim(),
          address: form.address.trim(),
          district: form.district.trim(),
          city: form.city.trim(),
          latitude: Number(form.latitude),
          longitude: Number(form.longitude),
          maps_url: form.maps_url.trim(),
          contact_email: form.contact_email.trim(),
          contact_phone: form.contact_phone.trim(),
          contact_person: form.contact_person.trim(),
          opens_at: form.opens_at,
          closes_at: form.closes_at,
          is_open_manual: form.is_open_manual,
        },
      }),
    onSuccess: () => {
      toast.success("Başvurunuz alındı. Kurucu incelemesinden sonra bilgilendirileceksiniz.");
      setForm(emptyForm);
      void queryClient.invalidateQueries({ queryKey: ["my-business-applications"] });
    },
    onError: (error: Error) => toast.error(toPublicErrorMessage(error, "Başvuru gönderilemedi.")),
  });

  const rows = mine.data ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <p className="inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-accent">
          <Store className="size-4" /> İşletme başvurusu
        </p>
        <h1 className="mt-3 text-3xl font-semibold">İşletmenizi platforma ekleyin</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tüm alanlar zorunludur. Başvurunuz kurucu tarafından incelenip onaylandığında işletme
          hesabınız oluşturulur ve iletişim e-postanıza doğrulama kodu gönderilir.
        </p>
      </header>

      <form
        className="space-y-4 rounded-3xl border border-border bg-card p-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (!activeSector) {
            toast.error("Kategori seçin.");
            return;
          }
          submitMutation.mutate();
        }}
      >
        <div className="space-y-1">
          <Label>İşletme adı</Label>
          <Input
            value={form.name}
            onChange={(event) => {
              const name = event.target.value;
              setForm((current) => ({
                ...current,
                name,
                slug: current.slug !== slugify(current.name) ? current.slug : slugify(name),
              }));
            }}
            required
          />
        </div>
        <div className="space-y-1">
          <Label>URL adı</Label>
          <Input
            placeholder="ornek-isletme"
            value={form.slug}
            onChange={(event) => setForm({ ...form, slug: slugify(event.target.value) })}
            required
          />
        </div>
        <div className="space-y-1">
          <Label>Kısa tanıtım</Label>
          <Textarea
            value={form.tagline}
            onChange={(event) => setForm({ ...form, tagline: event.target.value })}
            required
          />
        </div>

        <div className="space-y-2">
          <Label>Kategori</Label>
          {categories.length === 0 ? (
            <p className="text-xs text-destructive">Şu anda seçilebilir kategori yok.</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {categories.map((sector) => (
              <button
                key={sector.slug}
                type="button"
                onClick={() => setForm({ ...form, sector: sector.slug })}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  activeSector === sector.slug
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "border-border"
                }`}
              >
                {sector.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <Label>Alt tür (Kebap, Pizza, Manav…)</Label>
          <Input
            value={form.category}
            onChange={(event) => setForm({ ...form, category: event.target.value })}
            required
          />
        </div>
        <div className="space-y-1">
          <Label>Etiketler (virgülle)</Label>
          <Input
            value={form.cuisines}
            onChange={(event) => setForm({ ...form, cuisines: event.target.value })}
            required
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="space-y-1">
            <Label>Teslimat süresi (dk)</Label>
            <Input
              type="number"
              min={0}
              value={form.delivery_minutes}
              onChange={(event) => setForm({ ...form, delivery_minutes: event.target.value })}
              required
            />
          </div>
          <div className="space-y-1">
            <Label>Teslimat ücreti</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.delivery_fee}
              onChange={(event) => setForm({ ...form, delivery_fee: event.target.value })}
              required
            />
          </div>
          <div className="space-y-1">
            <Label>Min. sepet</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.min_order}
              onChange={(event) => setForm({ ...form, min_order: event.target.value })}
              required
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label>Görsel adresi (https://…)</Label>
          <Input
            value={form.cover_image_url}
            onChange={(event) => setForm({ ...form, cover_image_url: event.target.value })}
            required
          />
        </div>

        <div className="space-y-2 rounded-2xl border border-border p-3">
          <p className="text-xs font-medium text-muted-foreground">Konum bilgileri (zorunlu)</p>
          <Input
            placeholder="Açık adres (Mahalle, sokak, no)"
            value={form.address}
            onChange={(event) => setForm({ ...form, address: event.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="İlçe"
              value={form.district}
              onChange={(event) => setForm({ ...form, district: event.target.value })}
              required
            />
            <Input
              placeholder="Şehir"
              value={form.city}
              onChange={(event) => setForm({ ...form, city: event.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder={LATITUDE_FIELD_PLACEHOLDER}
              value={form.latitude}
              onChange={(event) => setForm({ ...form, latitude: event.target.value })}
              required
            />
            <Input
              placeholder={LONGITUDE_FIELD_PLACEHOLDER}
              value={form.longitude}
              onChange={(event) => setForm({ ...form, longitude: event.target.value })}
              required
            />
          </div>
          <Input
            placeholder="WhatsApp konum veya Google Maps bağlantısı (https://maps…)"
            value={form.maps_url}
            onChange={(event) => setForm({ ...form, maps_url: event.target.value })}
            required
          />
        </div>

        <div className="space-y-2 rounded-2xl border border-border p-3">
          <p className="text-xs font-medium text-muted-foreground">
            İletişim — onaydan sonra bu e-postaya 6 haneli doğrulama kodu gönderilir
          </p>
          <Input
            type="email"
            inputMode="email"
            placeholder="İşletme e-postası"
            value={form.contact_email}
            onChange={(event) => setForm({ ...form, contact_email: event.target.value })}
            required
          />
          <Input
            type="tel"
            inputMode="tel"
            placeholder="İşletme telefonu (05xx xxx xx xx)"
            value={form.contact_phone}
            onChange={(event) => setForm({ ...form, contact_phone: event.target.value })}
            required
          />
          <Input
            placeholder="Yetkili ad soyad (kişisel isim)"
            autoComplete="name"
            value={form.contact_person}
            onChange={(event) => setForm({ ...form, contact_person: event.target.value })}
            required
          />
        </div>

        <div className="space-y-3 rounded-2xl border border-border p-3">
          <p className="text-xs font-medium text-muted-foreground">Çalışma saatleri (zorunlu)</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Açılış</Label>
              <Input
                type="time"
                value={form.opens_at}
                onChange={(event) => setForm({ ...form, opens_at: event.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Kapanış</Label>
              <Input
                type="time"
                value={form.closes_at}
                onChange={(event) => setForm({ ...form, closes_at: event.target.value })}
                required
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Şu an sipariş alıyor</span>
            <Switch
              checked={form.is_open_manual}
              onCheckedChange={(checked) => setForm({ ...form, is_open_manual: checked })}
            />
          </div>
        </div>

        <Button type="submit" className="rounded-full" disabled={submitMutation.isPending}>
          Başvuruyu gönder
        </Button>
      </form>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Başvurularım</h2>
        {mine.isLoading ? (
          <p className="mt-2 text-sm text-muted-foreground">Yükleniyor…</p>
        ) : rows.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Henüz başvurunuz yok.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {rows.map((row) => (
              <div key={row.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{row.name}</p>
                  <span className="rounded-full bg-accent/15 px-3 py-1 text-xs text-accent">
                    {STATUS_LABELS[row.status] ?? row.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDateTime(row.created_at)} · /{row.slug}
                </p>
                {row.status === "approved" ? (
                  <p className="mt-2 text-sm">
                    İşletmenizi şu e-posta ile yönetebilirsiniz:{" "}
                    <strong className="break-all">{row.contact_email}</strong>
                  </p>
                ) : null}
                {row.founder_note ? (
                  <p className="mt-2 text-sm text-muted-foreground">Not: {row.founder_note}</p>
                ) : null}

              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
