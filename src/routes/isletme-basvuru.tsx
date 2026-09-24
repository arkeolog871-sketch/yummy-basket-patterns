import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Store } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { EmailCodeLogin } from "@/components/auth/EmailCodeLogin";
import { startAppleOAuth, humanizeOAuthError as humanizeAppleOAuthError } from "@/lib/apple-oauth";
import { nativeOAuthBridge, startGoogleOAuth } from "@/lib/google-oauth";
import {
  hasNativeIosAuth,
  isIosNativeApp,
  signInWithNativeIosApple,
  signInWithNativeIosGoogle,
} from "@/lib/ios-native-auth";
import { useNativeGoogleSignIn } from "@/hooks/useNativeGoogleSignIn";

import { useAppCategories, useBusinessCategoryCatalog } from "@/hooks/useTaxonomy";
import { resolveCatalogSector } from "@/lib/business-category-catalog";
import { CategorySearchField } from "@/components/business/CategorySearchField";
import { slugify, formatDateTime } from "@/lib/format";
import { toPublicErrorMessage } from "@/lib/public-error";
import { parseDecimalInput } from "@/lib/decimal-input";
import {
  submitBusinessApplication,
  listMyBusinessApplications,
} from "@/lib/business-applications.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { LocationPicker } from "@/components/business/LocationPicker";

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
  // Native akış başlayıp başarısız olursa giriş sessizce ölmesin: tarayıcıya düş.
  const { busy: googleNativeBusy, start: startNativeGoogle } = useNativeGoogleSignIn(() => {
    void startBrowserGoogle();
  });
  // Apple'ın Android için native bir giriş SDK'sı yok; tarayıcı tabanlı akış
  // orada güvenilir uygulamaya dönemiyor ve Apple'ın kendi App Store
  // incelemesi dışında bir gereksinim yok — Android'de hiç göstermiyoruz.
  // Sunucu köprüyü göremez; ilk render sunucuyla aynı olmalı, yoksa hydration
  // uyuşmazlığı oluşur (bkz. auth.tsx'teki aynı düzeltme).
  const [isAndroidNativeApp, setIsAndroidNativeApp] = useState(false);
  useEffect(() => {
    setIsAndroidNativeApp(Boolean(nativeOAuthBridge()));
  }, []);

  async function handleApple() {
    // iOS: giriş uygulama içinde tamamlanır (bkz. src/lib/ios-native-auth.ts).
    if (hasNativeIosAuth("signInWithApple")) {
      const native = await signInWithNativeIosApple();
      if (native.ok === null) return; // kullanıcı vazgeçti
      if (!native.ok) toast.error(native.error);
      return;
    }
    // Buraya düşmek, köprünün bulunamadığı anlamına gelir. iOS'ta tarayıcı
    // akışına geçmek Apple'ın reddettiği davranışı birebir geri getirir
    // (Guideline 4: "kullanıcı giriş için varsayılan tarayıcıya çıkarılıyor").
    // Uygulama içinde görünür bir hata vermek, uygulamadan çıkmaktan iyidir;
    // e-posta ile giriş her koşulda açık duruyor.
    if (isIosNativeApp()) {
      toast.error(
        "Giriş şu anda başlatılamadı. Uygulamayı kapatıp yeniden açın ya da e-posta ile giriş yapın.",
      );
      return;
    }
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

  async function startBrowserGoogle() {
    try {
      const result = await startGoogleOAuth();
      if (!result.ok) toast.error(result.error);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Google girişi başlatılamadı.");
    }
  }

  async function handleGoogle() {
    // Credential Manager köprüsü varsa hesap seçimi uygulama içinde yapılır.
    if (startNativeGoogle()) return;
    if (hasNativeIosAuth("signInWithGoogle")) {
      const native = await signInWithNativeIosGoogle();
      if (native.ok === null) return; // kullanıcı vazgeçti
      if (!native.ok) toast.error(native.error);
      return;
    }
    // Buraya düşmek, köprünün bulunamadığı anlamına gelir. iOS'ta tarayıcı
    // akışına geçmek Apple'ın reddettiği davranışı birebir geri getirir
    // (Guideline 4: "kullanıcı giriş için varsayılan tarayıcıya çıkarılıyor").
    // Uygulama içinde görünür bir hata vermek, uygulamadan çıkmaktan iyidir;
    // e-posta ile giriş her koşulda açık duruyor.
    if (isIosNativeApp()) {
      toast.error(
        "Giriş şu anda başlatılamadı. Uygulamayı kapatıp yeniden açın ya da e-posta ile giriş yapın.",
      );
      return;
    }
    await startBrowserGoogle();
  }

  if (loading) {
    return (
      <p className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted-foreground">Yükleniyor…</p>
    );
  }

  if (!verified) {
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <header className="mb-6 text-center">
          <p className="inline-flex items-center gap-2 rounded-full bg-accent/30 px-3 py-1 text-xs font-medium text-accent-foreground">
            <Store className="size-4" /> İşletme başvurusu
          </p>
          <h1 className="mt-3 text-2xl font-semibold">Önce kimliğinizi doğrulayın</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            E-posta kodu, Google veya Apple ile doğrulandıktan sonra başvuru formu açılır.
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
              disabled={googleNativeBusy}
              onClick={() => void handleGoogle()}
            >
              {googleNativeBusy ? "Google hesabı seçiliyor…" : "Google ile devam et"}
            </Button>
            {isAndroidNativeApp ? null : (
              <Button
                type="button"
                variant="outline"
                className="mt-3 w-full rounded-full"
                onClick={() => void handleApple()}
              >
                Apple ile devam et
              </Button>
            )}
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {isAndroidNativeApp
                ? "Google ile doğrulama tamamlandıktan sonra bu sayfaya geri dönüp başvurunuzu gönderebilirsiniz."
                : "Google veya Apple ile doğrulama tamamlandıktan sonra bu sayfaya geri dönüp başvurunuzu gönderebilirsiniz."}
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

/**
 * Sayıya çevrilen alanlar ve kullanıcının ekranda gördüğü adları. Ad olmadan
 * hata mesajı "bir sayı hatalı" demekten öteye geçemiyor; formda beş sayı
 * alanı var ve hangisi olduğunu bulmak kullanıcıya kalıyordu.
 */
const NUMERIC_FIELDS = [
  { key: "delivery_minutes", label: "Teslimat süresi (dk)" },
  { key: "delivery_fee", label: "Teslimat ücreti" },
  { key: "min_order", label: "Min. sepet" },
  { key: "latitude", label: "Enlem" },
  { key: "longitude", label: "Boylam" },
] as const;

type NumericKey = (typeof NUMERIC_FIELDS)[number]["key"];
/** Konum alanları "iş yerim yok" seçilince boş (null) gider. */
type ParsedNumbers = Record<Exclude<NumericKey, "latitude" | "longitude">, number> & {
  latitude: number | null;
  longitude: number | null;
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
  /** İş yerim yok: adrese giderek hizmet (harita ve açık adres istenmez). */
  mobile_service: false,
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
  const { catalog } = useBusinessCategoryCatalog();
  const { user } = useAuth();
  const [form, setForm] = useState(emptyForm);
  // Haritaya verilen değer de ham Number() ile değil parseDecimalInput ile
  // okunur: virgüllü yazımda ("38,15") Number() NaN döndürüp işaretçiyi
  // sessizce kaybediyordu.
  const pickedLat = parseDecimalInput(form.latitude);
  const pickedLng = parseDecimalInput(form.longitude);
  const pickedPoint =
    pickedLat !== null && pickedLng !== null ? { lat: pickedLat, lng: pickedLng } : null;
  const loginEmail = user?.email ?? "";

  // Başvuru giriş kimliğine bağlanır: iletişim/kimlik alanları hesaptan otomatik
  // doldurulur (kullanıcı dilerse değiştirir). E-posta giriş e-postası olarak
  // gelir; farklı bir e-posta girilirse aşağıda kırmızı uyarı çıkar. Alanlar
  // yalnızca boşsa doldurulur ki kullanıcının kendi düzenlemesi ezilmesin.
  useEffect(() => {
    if (!user) return;
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const fullName =
      typeof meta["full_name"] === "string"
        ? meta["full_name"]
        : typeof meta["name"] === "string"
          ? meta["name"]
          : "";
    const metaPhone = typeof meta["phone"] === "string" ? meta["phone"] : "";
    setForm((prev) => ({
      ...prev,
      contact_person: prev.contact_person || fullName,
      contact_phone: prev.contact_phone || user.phone || metaPhone,
    }));
  }, [user]);

  const mine = useQuery({
    queryKey: ["my-business-applications"],
    queryFn: () => fetchMine(),
  });

  const activeSector = form.sector || categories[0]?.slug || "";

  /**
   * Sayı alanları gönderimden önce burada okunur. Biri okunamazsa istek hiç
   * gönderilmez: sunucuya NaN gidince dönen cevap "Expected number, received
   * nan" oluyordu — İngilizce ve hangi alan olduğunu söylemiyor.
   */
  function readNumbers(): ParsedNumbers | null {
    const parsed = {} as Record<NumericKey, number | null>;
    for (const field of NUMERIC_FIELDS) {
      // İş yeri yoksa konum gönderilmez (haritada işaret kalmış olsa bile).
      if (form.mobile_service && (field.key === "latitude" || field.key === "longitude")) {
        parsed[field.key] = null;
        continue;
      }
      const value = parseDecimalInput(form[field.key]);
      if (value === null) {
        toast.error(`${field.label}: sayı olarak girin. Ondalık için virgül kullanabilirsiniz.`);
        return null;
      }
      parsed[field.key] = value;
    }
    return parsed as ParsedNumbers;
  }

  const submitMutation = useMutation({
    mutationFn: (numbers: ParsedNumbers) =>
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
          delivery_minutes: numbers.delivery_minutes,
          delivery_fee: numbers.delivery_fee,
          min_order: numbers.min_order,
          cover_image_url: form.cover_image_url.trim(),
          mobile_service: form.mobile_service,
          address: form.mobile_service ? null : form.address.trim(),
          district: form.district.trim(),
          city: form.city.trim(),
          latitude: numbers.latitude,
          longitude: numbers.longitude,
          maps_url: form.mobile_service ? null : form.maps_url.trim(),
          contact_email: loginEmail.trim(),
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
        <p className="inline-flex items-center gap-2 rounded-full bg-accent/30 px-3 py-1 text-xs font-medium text-accent-foreground">
          <Store className="size-4" /> İşletme başvurusu
        </p>
        <h1 className="mt-3 text-3xl font-semibold">İşletmenizi platforma ekleyin</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Görsel adresi, harita bağlantısı ve etiketler dışındaki alanlar zorunludur. İşletmeniz
          giriş yaptığınız hesaba bağlanır; iletişim bilgileri hesabınızdan otomatik doldurulur.
          Başvurunuz kurucu tarafından incelenip onaylandığında işletme hesabınız etkinleşir.
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
          if (!form.mobile_service && (!form.latitude.trim() || !form.longitude.trim())) {
            toast.error("Haritadan işletmenizin konumunu işaretleyin.");
            return;
          }
          if (!loginEmail.trim()) {
            toast.error("Giriş e-postanız bulunamadı. Lütfen tekrar giriş yapın.");
            return;
          }
          const numbers = readNumbers();
          if (!numbers) return;
          submitMutation.mutate(numbers);
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
            onChange={(event) => setForm({ ...form, tagline: event.target.value.slice(0, 160) })}
            maxLength={160}
            required
          />
          {/* Sunucu 160 karakterle sınırlıyor; sınırı burada da göstererek
              esnafın uzun tanıtım yazıp gönderimde hata almasını engelliyoruz. */}
          <p className="text-right text-xs text-muted-foreground">{form.tagline.length}/160</p>
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
          <Label htmlFor="business-category-search">İşletme türü (Alt tür)</Label>
          <CategorySearchField
            inputId="business-category-search"
            catalog={catalog}
            value={form.category}
            required
            suggestSector={activeSector}
            onChange={(category) => setForm((current) => ({ ...current, category }))}
            onPick={(entry) =>
              setForm((current) => ({
                ...current,
                category: entry.name,
                // Eşleşen ana kategori varsa o da seçilir; yoksa seçim aynen kalır.
                sector:
                  resolveCatalogSector(
                    entry,
                    categories.map((item) => item.slug),
                  ) ?? current.sector,
              }))
            }
            sectorLabel={(entry) => {
              const slug = resolveCatalogSector(
                entry,
                categories.map((item) => item.slug),
              );
              return categories.find((item) => item.slug === slug)?.label ?? null;
            }}
          />
          <p className="text-xs text-muted-foreground">
            Yazmaya başlayın: 400'ü aşkın işletme türü arasından seçin. Listede yoksa yazdığınız ad
            kullanılır.
          </p>
        </div>
        <div className="space-y-1">
          <Label>Etiketler (virgülle, isteğe bağlı)</Label>
          <Input
            value={form.cuisines}
            onChange={(event) => setForm({ ...form, cuisines: event.target.value })}
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
          <Label>Görsel adresi (https://…, isteğe bağlı)</Label>
          <Input
            value={form.cover_image_url}
            onChange={(event) => setForm({ ...form, cover_image_url: event.target.value })}
          />
        </div>

        <div className="space-y-2 rounded-2xl border border-border p-3">
          <p className="text-xs font-medium text-muted-foreground">
            {form.mobile_service ? "Hizmet bölgesi (zorunlu)" : "Konum bilgileri (zorunlu)"}
          </p>
          {form.mobile_service ? null : (
            <Input
              placeholder="Açık adres (Mahalle, sokak, no)"
              value={form.address}
              onChange={(event) => setForm({ ...form, address: event.target.value })}
              required
            />
          )}
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
          {/* İş yeri yoksa harita pasif: işaretlenemez, konum gönderilmez. */}
          <div
            className={form.mobile_service ? "pointer-events-none select-none opacity-40" : ""}
            aria-disabled={form.mobile_service || undefined}
            inert={form.mobile_service || undefined}
          >
            <LocationPicker
              disabled={form.mobile_service}
              value={pickedPoint}
              onChange={(point) =>
                setForm((prev) => ({
                  ...prev,
                  latitude: point.lat.toFixed(6),
                  longitude: point.lng.toFixed(6),
                }))
              }
            />
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2.5">
            <input
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 accent-primary"
              checked={form.mobile_service}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, mobile_service: event.target.checked }))
              }
            />
            <span className="text-sm">
              <span className="font-medium">İş yerim yok</span>
              <span className="block text-xs text-muted-foreground">
                Müşterinin adresine giderek hizmet veriyorum (tesisatçı, usta, nakliye vb.). Harita
                ve açık adres istenmez; müşterilere “Adrese gelir” ve hizmet bölgeniz (ilçe, şehir)
                gösterilir.
              </span>
            </span>
          </label>
          {form.mobile_service ? null : (
            <Input
              placeholder="WhatsApp konum veya Google Maps bağlantısı (https://maps…, isteğe bağlı)"
              value={form.maps_url}
              onChange={(event) => setForm({ ...form, maps_url: event.target.value })}
            />
          )}
        </div>

        <div className="space-y-2 rounded-2xl border border-border p-3">
          <p className="text-xs font-medium text-muted-foreground">
            İletişim — işletmeniz giriş hesabınıza bağlanır; ad ve telefon hesabınızdan otomatik
            dolduruldu, gerekirse düzenleyin
          </p>
          {/* İşletme e-postası ayrı bir alan değil: her zaman giriş e-postasıdır
              (e-posta/Google/Apple ile giriş). Kullanıcı düzenleyemez, ek doğrulama
              istenmez — hesabın kendisi zaten doğrulanmış giriş kimliğidir. */}
          <div className="rounded-xl border border-border bg-muted/40 px-3 py-2">
            <p className="text-xs text-muted-foreground">İşletme e-postası (giriş hesabınız)</p>
            <p className="mt-0.5 break-all text-sm font-medium">{loginEmail || "—"}</p>
          </div>
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
                  <span className="rounded-full bg-accent/30 px-3 py-1 text-xs text-accent-foreground">
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
