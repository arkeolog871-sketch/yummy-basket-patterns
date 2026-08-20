import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Crown, Plus, Trash2, Pencil, ShieldCheck, LogOut, ExternalLink, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAccess } from "@/hooks/useAccess";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { readTwoFactorState, clearTwoFactorFlag } from "@/lib/two-factor";
import { SecurityPanel } from "@/components/founder/SecurityPanel";
import { AppearancePanel } from "@/components/founder/AppearancePanel";
import { BrandingPanel } from "@/components/founder/BrandingPanel";
import { HeroContentPanel } from "@/components/founder/HeroContentPanel";
import { CategoryPanel } from "@/components/founder/CategoryPanel";
import { ServiceAreaPanel } from "@/components/founder/ServiceAreaPanel";
import { useAppCategories } from "@/hooks/useTaxonomy";
import { SECTORS } from "@/lib/sectors";
import { formatPrice, formatDateTime, ORDER_STATUS_LABELS, slugify } from "@/lib/format";
import {
  claimFounder,
  listAdminData,
  listUsers,
  saveBusiness,
  deleteBusiness,
  saveMenuCategory,
  deleteMenuCategory,
  saveMenuItem,
  deleteMenuItem,
  setUserRole,
  deleteUser,
  createStaffUser,
  updateOrderStatus,
  setVendorAssignment,
} from "@/lib/founder.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuditLogPanel } from "@/components/founder/AuditLogPanel";

export const Route = createFileRoute("/kurucu")({
  head: () => ({
    meta: [
      { title: "Kurucu Paneli — SofraKapımda" },
      {
        name: "description",
        content:
          "Kurucu profili: tema ve renk ayarları, işletme, kategori, ürün, kullanıcı ve sipariş yönetimi.",
      },
      { property: "og:title", content: "Kurucu Paneli — SofraKapımda" },
      {
        property: "og:description",
        content: "Tüm işletme, ürün, kullanıcı ve tasarım ayarlarını tek panelden yönetin.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FounderRoute,
});

function FounderRoute() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    clearTwoFactorFlag();
    await supabase.auth.signOut();
    navigate({ to: "/kurucu-giris", replace: true });
  }

  return (
    <TwoFactorGate>
      <FounderShell onSignOut={handleSignOut} loading={loading} email={user?.email ?? null} hasUser={Boolean(user)} />
    </TwoFactorGate>
  );
}

/** 2FA etkinse, ikinci adımı geçmemiş oturumlara paneli göstermez. */
function TwoFactorGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [blocked, setBlocked] = useState<boolean | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setBlocked(false);
      return;
    }
    let active = true;
    void readTwoFactorState(user.id)
      .then((state) => {
        if (active) setBlocked(state.enrolled && !state.satisfied);
      })
      .catch(() => active && setBlocked(false));
    return () => {
      active = false;
    };
  }, [user, loading]);

  if (blocked === null && user) {
    return <div className="px-4 py-24 text-center text-sm text-muted-foreground">Doğrulanıyor…</div>;
  }

  if (blocked) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-3xl bg-warm text-warm-foreground">
          <ShieldCheck className="size-6" />
        </span>
        <h1 className="mt-5 text-3xl">İki adımlı doğrulama gerekli</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Bu oturum ikinci adımı geçmedi. Kurucu girişinden doğrulama kodunuzu veya bir yedek kodu girin.
        </p>
        <Button asChild className="mt-6 rounded-full">
          <Link to="/kurucu-giris">Doğrulamaya git</Link>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}

function FounderShell({
  onSignOut,
  loading,
  email,
  hasUser,
}: {
  onSignOut: () => Promise<void>;
  loading: boolean;
  email: string | null;
  hasUser: boolean;
}) {

  if (loading) {
    return (
      <div className="px-4 py-24 text-center text-sm text-muted-foreground">Yükleniyor…</div>
    );
  }

  if (!hasUser) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-3xl bg-warm text-warm-foreground">
          <Crown className="size-6" />
        </span>
        <h1 className="mt-5 text-3xl">Kurucu girişi gerekli</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Bu çalışma alanı yalnızca kurucu portalından erişilebilir.
        </p>
        <Button asChild className="mt-6 rounded-full">
          <Link to="/kurucu-giris">Kurucu girişine git</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b border-border/70 bg-card/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-warm text-primary-foreground">
              <Crown className="size-4" />
            </span>
            <div className="leading-tight">
              <p className="font-display text-sm font-semibold">Kurucu çalışma alanı</p>
              <p className="text-xs text-muted-foreground">{email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="rounded-full">
              <Link to="/">
                <ExternalLink className="size-4" /> Siteyi gör
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => void onSignOut()}
            >
              <LogOut className="size-4" /> Çıkış
            </Button>
          </div>
        </div>
      </header>
      <FounderPage />
    </div>
  );
}

function FounderPage() {
  const { isFounder, founderExists, refresh } = useSiteSettings();
  const access = useAccess();
  const claim = useServerFn(claimFounder);

  const claimMutation = useMutation({
    mutationFn: () => claim(),
    onSuccess: () => {
      toast.success("Kurucu profili sizin adınıza tanımlandı");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (access.loading) {
    return <div className="px-4 py-24 text-center text-sm text-muted-foreground">Yükleniyor…</div>;
  }

  // İşletme hesapları kurucu URL'ine elle girse bile 403 alır ve kendi paneline döner.
  if (!isFounder && access.isVendor) {
    return (
      <AccessDenied message="Kurucu paneli işletme hesaplarına kapalıdır. İşletme panelinize yönlendiriliyorsunuz." />
    );
  }

  if (!isFounder) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-3xl bg-warm text-warm-foreground">
          <Crown className="size-6" />
        </span>
        <h1 className="mt-5 text-3xl">Kurucu profili</h1>
        {founderExists ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Bu panel yalnızca kurucu hesabına açıktır. Yetki almak için kurucu ile iletişime geçin.
          </p>
        ) : (
          <>
            <p className="mt-3 text-sm text-muted-foreground">
              Henüz kurucu tanımlı değil. Bu hesabı kurucu olarak tanımlayarak tüm yönetim
              yetkilerini alabilirsiniz.
            </p>
            <Button
              className="mt-6 rounded-full"
              disabled={claimMutation.isPending}
              onClick={() => claimMutation.mutate()}
            >
              <ShieldCheck className="size-4" /> Kurucu profilini üstlen
            </Button>
          </>
        )}
        <div className="mt-4">
          <Button asChild variant="ghost" className="rounded-full">
            <Link to="/">Ana sayfaya dön</Link>
          </Button>
        </div>
      </div>
    );
  }

  return <FounderDashboard />;
}

function FounderDashboard() {
  const queryClient = useQueryClient();
  const fetchAdminData = useServerFn(listAdminData);
  const fetchUsers = useServerFn(listUsers);

  const data = useQuery({ queryKey: ["admin-data"], queryFn: () => fetchAdminData() });
  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => fetchUsers() });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["admin-data"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    void queryClient.invalidateQueries({ queryKey: ["restaurants"] });
    void queryClient.invalidateQueries({ queryKey: ["categories"] });
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-gradient-warm text-primary-foreground shadow-glow">
          <Crown className="size-5" />
        </span>
        <div>
          <h1 className="text-3xl">Kurucu paneli</h1>
          <p className="text-sm text-muted-foreground">
            Tema, işletme, kategori, ürün, kullanıcı ve sipariş yönetimi
          </p>
        </div>
      </div>

      <Tabs defaultValue="gorunum" className="mt-8">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="gorunum">Görünüm</TabsTrigger>
          <TabsTrigger value="gorseller">Görseller</TabsTrigger>
          <TabsTrigger value="anasayfa">Ana sayfa</TabsTrigger>
          <TabsTrigger value="sektorler">Kategoriler</TabsTrigger>
          <TabsTrigger value="bolgeler">Bölgeler</TabsTrigger>
          <TabsTrigger value="isletmeler">İşletmeler</TabsTrigger>
          <TabsTrigger value="kategoriler">Menü kategorileri</TabsTrigger>
          <TabsTrigger value="urunler">Ürünler</TabsTrigger>
          <TabsTrigger value="kullanicilar">Kullanıcılar</TabsTrigger>
          <TabsTrigger value="guvenlik">Güvenlik</TabsTrigger>
          <TabsTrigger value="siparisler">Siparişler</TabsTrigger>
          <TabsTrigger value="denetim">Denetim kaydı</TabsTrigger>
        </TabsList>

        <TabsContent value="gorunum" className="mt-6">
          <AppearancePanel />
        </TabsContent>

        <TabsContent value="gorseller" className="mt-6">
          <BrandingPanel />
        </TabsContent>

        <TabsContent value="anasayfa" className="mt-6">
          <HeroContentPanel />
        </TabsContent>

        <TabsContent value="sektorler" className="mt-6">
          <CategoryPanel businesses={data.data?.businesses ?? []} />
        </TabsContent>

        <TabsContent value="bolgeler" className="mt-6">
          <ServiceAreaPanel />
        </TabsContent>

        <TabsContent value="isletmeler" className="mt-6">
          <BusinessPanel businesses={data.data?.businesses ?? []} onDone={invalidate} />
        </TabsContent>

        <TabsContent value="kategoriler" className="mt-6">
          <MenuCategoryPanel
            businesses={data.data?.businesses ?? []}
            categories={data.data?.categories ?? []}
            onDone={invalidate}
          />
        </TabsContent>

        <TabsContent value="urunler" className="mt-6">
          <MenuItemPanel
            businesses={data.data?.businesses ?? []}
            categories={data.data?.categories ?? []}
            items={data.data?.items ?? []}
            onDone={invalidate}
          />
        </TabsContent>

        <TabsContent value="kullanicilar" className="mt-6">
          <UserPanel
            users={users.data ?? []}
            businesses={data.data?.businesses ?? []}
            onDone={invalidate}
          />
        </TabsContent>

        <TabsContent value="guvenlik" className="mt-6">
          <SecurityPanel />
        </TabsContent>

        <TabsContent value="siparisler" className="mt-6">
          <OrderPanel
            orders={data.data?.orders ?? []}
            loading={data.isFetching}
            onDone={() => void queryClient.invalidateQueries({ queryKey: ["admin-data"] })}
          />
        </TabsContent>

        <TabsContent value="denetim" className="mt-6">
          <AuditLogPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}


type OrderRow = {
  id: string;
  status: string;
  payment_status?: string;
  total: number | string;
  recipient_name: string;
  phone?: string;
  street?: string;
  district?: string;
  city: string;
  created_at: string;
  restaurants?: { name: string } | null;
};

const ORDER_STATUS_OPTIONS = [
  "pending",
  "confirmed",
  "preparing",
  "on_the_way",
  "delivered",
  "cancelled",
] as const;

/** Gelen siparişlerin durumunu anlık olarak değiştirir. */
function OrderPanel({
  orders,
  loading,
  onDone,
}: {
  orders: OrderRow[];
  loading: boolean;
  onDone: () => void;
}) {
  const update = useServerFn(updateOrderStatus);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (input: { id: string; status: (typeof ORDER_STATUS_OPTIONS)[number] }) =>
      update({ data: input }),
    onSuccess: () => {
      toast.success("Sipariş durumu güncellendi");
      setPendingId(null);
      onDone();
    },
    onError: (error: Error) => {
      setPendingId(null);
      toast.error(error.message);
    },
  });

  if (orders.length === 0) {
    return (
      <div className="rounded-3xl border border-border bg-card p-6 text-sm text-muted-foreground">
        {loading ? "Yükleniyor…" : "Henüz sipariş yok."}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => (
        <div key={order.id} className="rounded-3xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">
                {order.restaurants?.name ?? "İşletme"} · {order.recipient_name}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(order.created_at)} · {order.street ? `${order.street}, ` : ""}
                {order.district ? `${order.district}/` : ""}
                {order.city}
                {order.phone ? ` · ${order.phone}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-warm px-3 py-1 text-xs font-semibold text-warm-foreground">
                {ORDER_STATUS_LABELS[order.status] ?? order.status}
              </span>
              <span className="font-semibold">{formatPrice(Number(order.total))}</span>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {ORDER_STATUS_OPTIONS.map((status) => {
              const active = order.status === status;
              return (
                <Button
                  key={status}
                  type="button"
                  size="sm"
                  variant={active ? "default" : "outline"}
                  className="rounded-full"
                  disabled={active || (mutation.isPending && pendingId === order.id)}
                  onClick={() => {
                    setPendingId(order.id);
                    mutation.mutate({ id: order.id, status });
                  }}
                >
                  {ORDER_STATUS_LABELS[status] ?? status}
                </Button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

type BusinessRow = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  category: string;
  sector: string | null;
  cuisines: string[];
  delivery_minutes: number;
  delivery_fee: number | string;
  min_order: number | string;
  cover_image_url: string | null;
  address?: string | null;
  district?: string | null;
  city?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  maps_url?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  is_active: boolean;
  opens_at?: string | null;
  closes_at?: string | null;
  is_open_manual?: boolean | null;
};

const emptyBusiness = {
  slug: "",
  name: "",
  tagline: "",
  category: "",
  sector: "" as string,
  cuisines: "",
  delivery_minutes: 30,
  delivery_fee: 0,
  min_order: 0,
  cover_image_url: "",
  address: "",
  district: "",
  city: "",
  latitude: "",
  longitude: "",
  maps_url: "",
  contact_email: "",
  contact_phone: "",
  is_active: true,
  opens_at: "",
  closes_at: "",
  is_open_manual: true,
};

function BusinessPanel({
  businesses,
  onDone,
}: {
  businesses: BusinessRow[];
  onDone: () => void;
}) {
  const save = useServerFn(saveBusiness);
  const remove = useServerFn(deleteBusiness);
  const { categories } = useAppCategories();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyBusiness);
  const activeSector = form.sector || categories[0]?.slug || "";

  const saveMutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          ...(editingId ? { id: editingId } : {}),
          slug: form.slug,
          name: form.name,
          tagline: form.tagline || null,
          category: form.category || "Genel",
          sector: form.sector || categories[0]?.slug || SECTORS[0].slug,
          cuisines: form.cuisines
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          delivery_minutes: Number(form.delivery_minutes),
          delivery_fee: Number(form.delivery_fee),
          min_order: Number(form.min_order),
          cover_image_url: form.cover_image_url || null,
          address: form.address.trim() || null,
          district: form.district.trim() || null,
          city: form.city.trim() || null,
          latitude:
            form.latitude.trim() && Number.isFinite(Number(form.latitude))
              ? Number(form.latitude)
              : null,
          longitude:
            form.longitude.trim() && Number.isFinite(Number(form.longitude))
              ? Number(form.longitude)
              : null,
          maps_url: form.maps_url.trim() || null,
          contact_email: form.contact_email.trim(),
          contact_phone: form.contact_phone.trim(),
          is_active: form.is_active,
          opens_at: /^\d{2}:\d{2}$/.test(form.opens_at) ? form.opens_at : null,
          closes_at: /^\d{2}:\d{2}$/.test(form.closes_at) ? form.closes_at : null,
          is_open_manual: form.is_open_manual,
        },
      }),
    onSuccess: () => {
      toast.success(
        editingId
          ? "İşletme ve giriş hesabı güncellendi"
          : "İşletme ve giriş hesabı oluşturuldu",
      );
      setEditingId(null);
      setForm(emptyBusiness);
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("İşletme silindi");
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <form
        className="space-y-3 rounded-3xl border border-border bg-card p-6"
        onSubmit={(event) => {
          event.preventDefault();
          saveMutation.mutate();
        }}
      >
        <p className="text-sm font-semibold">
          {editingId ? "İşletmeyi düzenle" : "Yeni işletme ekle"}
        </p>
        <Input
          placeholder="Ad"
          value={form.name}
          onChange={(event) => {
            const name = event.target.value;
            setForm((current) => ({
              ...current,
              name,
              slug:
                editingId || current.slug !== slugify(current.name) ? current.slug : slugify(name),
            }));
          }}
          required
        />
        <Input
          placeholder="URL adı (ornek-isletme)"
          value={form.slug}
          onChange={(event) => setForm({ ...form, slug: slugify(event.target.value) })}
          required
        />
        <Textarea
          placeholder="Kısa tanıtım"
          value={form.tagline}
          onChange={(event) => setForm({ ...form, tagline: event.target.value })}
        />
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Kategori (zorunlu) —{" "}
            {categories.find((item) => item.slug === activeSector)?.label ?? "seçim yapılmadı"}
          </p>
          {categories.length === 0 ? (
            <p className="text-xs text-destructive">
              Önce “Kategoriler” sekmesinden en az bir kategori ekleyin.
            </p>
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
        <Input
          placeholder="Alt tür (Kebap, Pizza, Manav…)"
          value={form.category}
          onChange={(event) => setForm({ ...form, category: event.target.value })}
        />
        <Input
          placeholder="Etiketler (virgülle)"
          value={form.cuisines}
          onChange={(event) => setForm({ ...form, cuisines: event.target.value })}
        />
        <div className="grid grid-cols-3 gap-2">
          <Input
            type="number"
            min={0}
            placeholder="Süre (dk)"
            value={form.delivery_minutes}
            onChange={(event) => setForm({ ...form, delivery_minutes: Number(event.target.value) })}
          />
          <Input
            type="number"
            min={0}
            step="0.01"
            placeholder="Teslimat"
            value={form.delivery_fee}
            onChange={(event) => setForm({ ...form, delivery_fee: Number(event.target.value) })}
          />
          <Input
            type="number"
            min={0}
            step="0.01"
            placeholder="Min. sepet"
            value={form.min_order}
            onChange={(event) => setForm({ ...form, min_order: Number(event.target.value) })}
          />
        </div>
        <Input
          placeholder="Görsel adresi"
          value={form.cover_image_url}
          onChange={(event) => setForm({ ...form, cover_image_url: event.target.value })}
        />
        <div className="space-y-2 rounded-2xl border border-border p-3">
          <p className="text-xs font-medium text-muted-foreground">
            Konum (isteğe bağlı) — girildiğinde kartlarda tıklanabilir yol tarifi görünür
          </p>
          <Input
            placeholder="Açık adres (Mahalle, sokak, no)"
            value={form.address}
            onChange={(event) => setForm({ ...form, address: event.target.value })}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="İlçe"
              value={form.district}
              onChange={(event) => setForm({ ...form, district: event.target.value })}
            />
            <Input
              placeholder="Şehir"
              value={form.city}
              onChange={(event) => setForm({ ...form, city: event.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Enlem (38.1423)"
              value={form.latitude}
              onChange={(event) => setForm({ ...form, latitude: event.target.value })}
            />
            <Input
              placeholder="Boylam (41.0021)"
              value={form.longitude}
              onChange={(event) => setForm({ ...form, longitude: event.target.value })}
            />
          </div>
          <Input
            placeholder="Google Maps bağlantısı (https://…)"
            value={form.maps_url}
            onChange={(event) => setForm({ ...form, maps_url: event.target.value })}
          />
        </div>
        <div className="space-y-2 rounded-2xl border border-border p-3">
          <p className="text-xs font-medium text-muted-foreground">
            İletişim — işletme girişinde bu e-posta veya telefon kullanılır
          </p>
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="İşletme e-postası (ornek@isletme.com)"
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
        </div>
        <div className="flex items-center justify-between rounded-2xl border border-border p-3">
          <span className="text-sm">Yayında</span>
          <Switch
            checked={form.is_active}
            onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
          />
        </div>
        <div className="space-y-3 rounded-2xl border border-border p-3">
          <p className="text-xs font-medium text-muted-foreground">
            Çalışma saatleri — boş bırakılırsa 24 saat açık kabul edilir
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Açılış</Label>
              <Input
                type="time"
                value={form.opens_at}
                onChange={(event) => setForm({ ...form, opens_at: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Kapanış</Label>
              <Input
                type="time"
                value={form.closes_at}
                onChange={(event) => setForm({ ...form, closes_at: event.target.value })}
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
        <div className="flex gap-2">
          <Button type="submit" className="rounded-full" disabled={saveMutation.isPending}>
            <Plus className="size-4" /> {editingId ? "Kaydet" : "Ekle"}
          </Button>
          {editingId ? (
            <Button
              type="button"
              variant="ghost"
              className="rounded-full"
              onClick={() => {
                setEditingId(null);
                setForm(emptyBusiness);
              }}
            >
              Vazgeç
            </Button>
          ) : null}
        </div>
      </form>

      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        {businesses.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Kayıtlı işletme yok.</p>
        ) : (
          businesses.map((business) => (
            <div
              key={business.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 p-4 last:border-0"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {business.name}
                  {business.is_active ? null : (
                    <span className="ml-2 text-xs text-muted-foreground">(gizli)</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {business.category} · /{business.slug}
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="outline"
                  className="rounded-full"
                  aria-label="Düzenle"
                  onClick={() => {
                    setEditingId(business.id);
                    setForm({
                      slug: business.slug,
                      name: business.name,
                      tagline: business.tagline ?? "",
                      category: business.category,
                      sector: business.sector ?? "",
                      cuisines: (business.cuisines ?? []).join(", "),
                      delivery_minutes: business.delivery_minutes,
                      delivery_fee: Number(business.delivery_fee),
                      min_order: Number(business.min_order),
                      cover_image_url: business.cover_image_url ?? "",
                      address: business.address ?? "",
                      district: business.district ?? "",
                      city: business.city ?? "",
                      latitude:
                        business.latitude === null || business.latitude === undefined
                          ? ""
                          : String(business.latitude),
                      longitude:
                        business.longitude === null || business.longitude === undefined
                          ? ""
                          : String(business.longitude),
                      maps_url: business.maps_url ?? "",
                      contact_email: business.contact_email ?? "",
                      contact_phone: business.contact_phone ?? "",
                      is_active: business.is_active,
                      opens_at: (business.opens_at ?? "").slice(0, 5),
                      closes_at: (business.closes_at ?? "").slice(0, 5),
                      is_open_manual: business.is_open_manual !== false,
                    });
                  }}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="rounded-full"
                  aria-label="Sil"
                  onClick={() => deleteMutation.mutate(business.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

type CategoryRow = { id: string; restaurant_id: string; name: string; position: number };

function MenuCategoryPanel({
  businesses,
  categories,
  onDone,
}: {
  businesses: BusinessRow[];
  categories: CategoryRow[];
  onDone: () => void;
}) {
  const save = useServerFn(saveMenuCategory);
  const remove = useServerFn(deleteMenuCategory);
  const [form, setForm] = useState({ restaurant_id: "", name: "", position: 0 });

  const saveMutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          restaurant_id: form.restaurant_id,
          name: form.name,
          position: Number(form.position),
        },
      }),
    onSuccess: () => {
      toast.success("Kategori kaydedildi");
      setForm({ restaurant_id: form.restaurant_id, name: "", position: 0 });
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Kategori silindi");
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <form
        className="space-y-3 rounded-3xl border border-border bg-card p-6"
        onSubmit={(event) => {
          event.preventDefault();
          saveMutation.mutate();
        }}
      >
        <p className="text-sm font-semibold">Yeni menü kategorisi</p>
        <select
          value={form.restaurant_id}
          onChange={(event) => setForm({ ...form, restaurant_id: event.target.value })}
          required
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">İşletme seçin</option>
          {businesses.map((business) => (
            <option key={business.id} value={business.id}>
              {business.name}
            </option>
          ))}
        </select>
        <Input
          placeholder="Kategori adı"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          required
        />
        <Input
          type="number"
          min={0}
          placeholder="Sıra"
          value={form.position}
          onChange={(event) => setForm({ ...form, position: Number(event.target.value) })}
        />
        <Button type="submit" className="rounded-full" disabled={saveMutation.isPending}>
          <Plus className="size-4" /> Ekle
        </Button>
      </form>

      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        {categories.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Kategori yok.</p>
        ) : (
          categories.map((category) => (
            <div
              key={category.id}
              className="flex items-center justify-between gap-3 border-b border-border/60 p-4 last:border-0"
            >
              <div>
                <p className="font-medium">{category.name}</p>
                <p className="text-xs text-muted-foreground">
                  {businesses.find((business) => business.id === category.restaurant_id)?.name ??
                    "—"}{" "}
                  · sıra {category.position}
                </p>
              </div>
              <Button
                size="icon"
                variant="outline"
                className="rounded-full"
                aria-label="Sil"
                onClick={() => deleteMutation.mutate(category.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

type ItemRow = {
  id: string;
  restaurant_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number | string;
  image_url: string | null;
  is_popular: boolean;
  is_available: boolean;
};

const emptyItem = {
  restaurant_id: "",
  category_id: "",
  name: "",
  description: "",
  price: 0,
  image_url: "",
  is_popular: false,
  is_available: true,
};

function MenuItemPanel({
  businesses,
  categories,
  items,
  onDone,
}: {
  businesses: BusinessRow[];
  categories: CategoryRow[];
  items: ItemRow[];
  onDone: () => void;
}) {
  const save = useServerFn(saveMenuItem);
  const remove = useServerFn(deleteMenuItem);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyItem);

  const saveMutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          ...(editingId ? { id: editingId } : {}),
          restaurant_id: form.restaurant_id,
          category_id: form.category_id || null,
          name: form.name,
          description: form.description || null,
          price: Number(form.price),
          image_url: form.image_url || null,
          is_popular: form.is_popular,
          is_available: form.is_available,
        },
      }),
    onSuccess: () => {
      toast.success(editingId ? "Ürün güncellendi" : "Ürün eklendi");
      setEditingId(null);
      setForm({ ...emptyItem, restaurant_id: form.restaurant_id });
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Ürün silindi");
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <form
        className="space-y-3 rounded-3xl border border-border bg-card p-6"
        onSubmit={(event) => {
          event.preventDefault();
          saveMutation.mutate();
        }}
      >
        <p className="text-sm font-semibold">{editingId ? "Ürünü düzenle" : "Yeni ürün"}</p>
        <select
          value={form.restaurant_id}
          onChange={(event) => setForm({ ...form, restaurant_id: event.target.value })}
          required
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">İşletme seçin</option>
          {businesses.map((business) => (
            <option key={business.id} value={business.id}>
              {business.name}
            </option>
          ))}
        </select>
        <select
          value={form.category_id}
          onChange={(event) => setForm({ ...form, category_id: event.target.value })}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Kategori (opsiyonel)</option>
          {categories
            .filter((category) => category.restaurant_id === form.restaurant_id)
            .map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
        </select>
        <Input
          placeholder="Ürün adı"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          required
        />
        <Textarea
          placeholder="Açıklama"
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
        />
        <Input
          type="number"
          min={0}
          step="0.01"
          placeholder="Fiyat"
          value={form.price}
          onChange={(event) => setForm({ ...form, price: Number(event.target.value) })}
        />
        <Input
          placeholder="Görsel adresi"
          value={form.image_url}
          onChange={(event) => setForm({ ...form, image_url: event.target.value })}
        />
        <div className="flex items-center justify-between rounded-2xl border border-border p-3">
          <span className="text-sm">Öne çıkan</span>
          <Switch
            checked={form.is_popular}
            onCheckedChange={(checked) => setForm({ ...form, is_popular: checked })}
          />
        </div>
        <div className="flex items-center justify-between rounded-2xl border border-border p-3">
          <span className="text-sm">Satışta</span>
          <Switch
            checked={form.is_available}
            onCheckedChange={(checked) => setForm({ ...form, is_available: checked })}
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" className="rounded-full" disabled={saveMutation.isPending}>
            <Plus className="size-4" /> {editingId ? "Kaydet" : "Ekle"}
          </Button>
          {editingId ? (
            <Button
              type="button"
              variant="ghost"
              className="rounded-full"
              onClick={() => {
                setEditingId(null);
                setForm(emptyItem);
              }}
            >
              Vazgeç
            </Button>
          ) : null}
        </div>
      </form>

      <div className="max-h-[36rem] overflow-y-auto rounded-3xl border border-border bg-card">
        {items.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Ürün yok.</p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 border-b border-border/60 p-4 last:border-0"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {businesses.find((business) => business.id === item.restaurant_id)?.name ?? "—"} ·{" "}
                  {formatPrice(Number(item.price))}
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="outline"
                  className="rounded-full"
                  aria-label="Düzenle"
                  onClick={() => {
                    setEditingId(item.id);
                    setForm({
                      restaurant_id: item.restaurant_id,
                      category_id: item.category_id ?? "",
                      name: item.name,
                      description: item.description ?? "",
                      price: Number(item.price),
                      image_url: item.image_url ?? "",
                      is_popular: item.is_popular,
                      is_available: item.is_available,
                    });
                  }}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="rounded-full"
                  aria-label="Sil"
                  onClick={() => deleteMutation.mutate(item.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

type UserRow = {
  id: string;
  email: string;
  created_at: string;
  roles: string[];
  vendorRestaurantId: string | null;
};

function UserPanel({
  users,
  businesses,
  onDone,
}: {
  users: UserRow[];
  businesses: { id: string; name: string }[];
  onDone: () => void;
}) {
  const setRole = useServerFn(setUserRole);
  const removeUser = useServerFn(deleteUser);
  const createUser = useServerFn(createStaffUser);
  const assignVendor = useServerFn(setVendorAssignment);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRoleValue] = useState<"founder" | "admin" | "user" | "vendor">("founder");
  const [verifyEmail, setVerifyEmail] = useState(true);

  const roleMutation = useMutation({
    mutationFn: (input: {
      userId: string;
      role: "admin" | "founder" | "user" | "vendor";
      grant: boolean;
    }) => setRole({ data: input }),
    onSuccess: () => {
      toast.success("Yetkiler güncellendi");
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const assignMutation = useMutation({
    mutationFn: (input: { userId: string; restaurantId: string | null }) =>
      assignVendor({ data: input }),
    onSuccess: () => {
      toast.success("İşletme ataması güncellendi");
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => removeUser({ data: { userId } }),
    onSuccess: () => {
      toast.success("Kullanıcı silindi");
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const createMutation = useMutation({
    mutationFn: () => createUser({ data: { email, password, phone, fullName, role, verifyEmail } }),
    onSuccess: (result: { verificationSent?: boolean }) => {
      toast.success(
        result?.verificationSent
          ? "Hesap oluşturuldu, doğrulama kodu e-postaya gönderildi"
          : verifyEmail
            ? "Hesap oluşturuldu ancak doğrulama e-postası gönderilemedi"
            : "Yetkili hesap oluşturuldu",
      );
      setEmail("");
      setPassword("");
      setPhone("");
      setFullName("");
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-4">
      <form
        className="rounded-3xl border border-border bg-card p-6"
        onSubmit={(event) => {
          event.preventDefault();
          createMutation.mutate();
        }}
      >
        <h2 className="text-xl">Yetkili kullanıcı ekle</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          E-posta ve telefon numarası zorunludur. E-posta doğrulama açıkken hesaba müşteri
          girişindeki ile aynı tek kullanımlık kod gönderilir ve hesap kod doğrulanana kadar
          onaysız kalır. Telefon numarası profile kaydedilir ve işlem denetim kaydına yazılır.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="staff-email">E-posta</Label>
            <Input
              id="staff-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-xl"
            />
            <p className="text-xs text-muted-foreground">
              Giriş ve doğrulama kodları bu adrese gönderilir.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="staff-phone">Telefon numarası</Label>
            <Input
              id="staff-phone"
              type="tel"
              inputMode="tel"
              placeholder="05xx xxx xx xx"
              required
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="staff-name">Ad soyad / işletme yetkilisi</Label>
            <Input
              id="staff-name"
              required
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="staff-password">Geçici şifre</Label>
            <Input
              id="staff-password"
              type="text"
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="staff-role">Rol</Label>
            <select
              id="staff-role"
              value={role}
              onChange={(event) =>
                setRoleValue(event.target.value as "founder" | "admin" | "user" | "vendor")
              }
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
            >
              <option value="founder">Kurucu</option>
              <option value="admin">Yönetici</option>
              <option value="vendor">İşletme</option>
              <option value="user">Kullanıcı</option>
            </select>
          </div>
        </div>
        {role === "vendor" ? (
          <p className="mt-3 text-xs text-muted-foreground">
            İşletme hesabı oluşturduktan sonra aşağıdaki listeden hangi işletmeye bağlı olduğunu
            seçin; atama yapılmadan işletme paneline erişemez.
          </p>
        ) : null}
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={verifyEmail}
            onChange={(event) => setVerifyEmail(event.target.checked)}
            className="size-4 rounded border-input"
          />
          E-posta doğrulama kodu gönder (önerilir)
        </label>
        <Button type="submit" className="mt-4 rounded-full" disabled={createMutation.isPending}>
          <UserPlus className="size-4" />{" "}
          {createMutation.isPending ? "Oluşturuluyor…" : "Hesabı oluştur"}
        </Button>
      </form>

      <div className="overflow-hidden rounded-3xl border border-border bg-card">
      {users.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground">Kullanıcı bulunamadı.</p>
      ) : (
        users.map((user) => (
          <div
            key={user.id}
            className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 p-4 last:border-0"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{user.email}</p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(user.created_at)} ·{" "}
                {user.roles.length ? user.roles.join(", ") : "yetki yok"}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <label className="text-xs text-muted-foreground" htmlFor={`vendor-${user.id}`}>
                  İşletme:
                </label>
                <select
                  id={`vendor-${user.id}`}
                  value={user.vendorRestaurantId ?? ""}
                  disabled={assignMutation.isPending}
                  onChange={(event) =>
                    assignMutation.mutate({
                      userId: user.id,
                      restaurantId: event.target.value || null,
                    })
                  }
                  className="h-8 max-w-[14rem] rounded-lg border border-input bg-background px-2 text-xs"
                >
                  <option value="">Atanmadı</option>
                  {businesses.map((business) => (
                    <option key={business.id} value={business.id}>
                      {business.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {(["admin", "founder"] as const).map((roleName) => {
                const has = user.roles.includes(roleName);
                return (
                  <Button
                    key={roleName}
                    size="sm"
                    variant={has ? "secondary" : "outline"}
                    className="rounded-full"
                    disabled={roleMutation.isPending}
                    onClick={() =>
                      roleMutation.mutate({ userId: user.id, role: roleName, grant: !has })
                    }
                  >
                    {has ? `${roleName} kaldır` : `${roleName} ver`}
                  </Button>
                );
              })}
              <Button
                size="icon"
                variant="outline"
                className="rounded-full"
                aria-label="Kullanıcıyı sil"
                onClick={() => deleteMutation.mutate(user.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))
      )}
      </div>
    </div>
  );
}
