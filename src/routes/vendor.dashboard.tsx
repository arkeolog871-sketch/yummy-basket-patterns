import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { toPublicErrorMessage } from "@/lib/public-error";
import { useEffect, useRef, useState } from "react";
import {
  Store,
  LogOut,
  ClipboardList,
  Package,
  ExternalLink,
  KeyRound,
  Bell,
  Image as ImageIcon,
} from "lucide-react";
import {
  showNativeNotification,
  loadSeenAlertIds,
  saveSeenAlertIds,
  VENDOR_ORDERS_ROUTE,
} from "@/lib/native-notify";
import { supabase } from "@/integrations/supabase/client";

import { RequireAuth } from "@/components/auth/RequireAuth";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { EmptyState } from "@/components/vendor/EmptyState";
import { ProductPanel } from "@/components/vendor/ProductPanel";
import { MediaPanel } from "@/components/vendor/MediaPanel";
import { EmailCodeLogin } from "@/components/auth/EmailCodeLogin";
import { useAccess } from "@/hooks/useAccess";
import { useAuth } from "@/hooks/useAuth";
import { useVendorMobileOrderNotification } from "@/hooks/useVendorMobileOrderNotification";
import { unregisterDevicePushToken } from "@/lib/vendor-mobile-notification.functions";
import { unregisterMobilePushTokenOnSignOut } from "@/lib/vendor-mobile-notification";

import {
  getVendorDashboard,
  markVendorOrderAlertRead,
  setVendorItemAvailability,
  setVendorOrderStatus,
  setVendorStoreOpen,
} from "@/lib/vendor.functions";
import {
  formatPrice,
  formatDateTime,
  ORDER_STATUS_LABELS,
  ORDER_TRACK_STEPS,
  orderStepIndex,
} from "@/lib/format";
import { isBusinessOpen } from "@/lib/hours";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changeVendorPassword } from "@/lib/vendor-auth.functions";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const VENDOR_TABS = ["siparisler", "bildirimler", "urunler", "gorseller", "guvenlik"] as const;
type VendorTab = (typeof VENDOR_TABS)[number];

function parseVendorTab(value: unknown): VendorTab {
  return typeof value === "string" && (VENDOR_TABS as readonly string[]).includes(value)
    ? (value as VendorTab)
    : "siparisler";
}

export const Route = createFileRoute("/vendor/dashboard")({
  validateSearch: (search: Record<string, unknown>): { tab?: VendorTab } => {
    const raw = search["tab"];
    if (raw === undefined || raw === null || raw === "") return {};
    return { tab: parseVendorTab(raw) };
  },
  head: () => ({
    meta: [
      { title: "İşletme Paneli — SİLVAN CEBİMDE" },
      {
        name: "description",
        content:
          "İşletme paneli: kendi siparişlerinizi takip edin, teslimat durumunu güncelleyin, stok ve mağaza durumunu yönetin.",
      },
      { property: "og:title", content: "İşletme Paneli — SİLVAN CEBİMDE" },
      {
        property: "og:description",
        content: "Siparişleri, stok durumunu ve mağaza açık/kapalı durumunu tek ekrandan yönetin.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <RequireAuth>
      <VendorGate />
    </RequireAuth>
  ),
});

const VENDOR_STATUS_FLOW = [
  { value: "confirmed", label: "Sipariş Alındı" },
  { value: "preparing", label: "Hazırlanıyor" },
  { value: "on_the_way", label: "Yolda" },
  { value: "delivered", label: "Teslim Edildi" },
  { value: "cancelled", label: "İptal" },
] as const;

type VendorStatus = (typeof VENDOR_STATUS_FLOW)[number]["value"];

function VendorGate() {
  const { loading, isVendor, isFounder, emailVerified } = useAccess();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  if (loading) {
    return <div className="px-4 py-24 text-center text-sm text-muted-foreground">Yükleniyor…</div>;
  }

  if (!isVendor) {
    return (
      <AccessDenied
        message={
          isFounder
            ? "Bu panel işletme hesaplarına özeldir. Kurucu yönetimi için kurucu panelini kullanın."
            : "Hesabınıza bağlı bir işletme bulunmuyor. İşletme yetkisi için kurucu ile iletişime geçin."
        }
      />
    );
  }

  if (!emailVerified) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-16">
        <h1 className="text-3xl">E-posta doğrulama</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          İşletme paneli için e-posta adresiniz doğrulanmalı. Size gönderilen 6 haneli kodu girin
          veya yeni kod isteyin.
        </p>
        <div className="mt-6 rounded-3xl border border-border/70 bg-card p-4 shadow-card sm:p-6">
          <EmailCodeLogin
            idPrefix="vendor-verify"
            allowSignUp={false}
            initialEmail={user?.email ?? ""}
            startAtCode={false}
            onVerified={async () => {
              toast.success("E-posta doğrulandı. İşletme profilinizi tamamlayabilirsiniz.");
              await queryClient.invalidateQueries({ queryKey: ["access-context"] });
              await queryClient.invalidateQueries({ queryKey: ["vendor-dashboard"] });
            }}
          />
        </div>
      </div>
    );
  }

  return <VendorDashboard />;
}

function VendorDashboard() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { tab: tabFromSearch } = Route.useSearch();
  const activeTab: VendorTab = tabFromSearch ?? "siparisler";
  const { restaurantId } = useAccess();
  useVendorMobileOrderNotification(true);
  const fetchDashboard = useServerFn(getVendorDashboard);
  const updateStatus = useServerFn(setVendorOrderStatus);
  const updateStore = useServerFn(setVendorStoreOpen);
  const updateItem = useServerFn(setVendorItemAvailability);
  const markAlertRead = useServerFn(markVendorOrderAlertRead);
  const unregisterPushToken = useServerFn(unregisterDevicePushToken);

  const dashboard = useQuery({
    queryKey: ["vendor-dashboard"],
    queryFn: () => fetchDashboard(),
    refetchInterval: 15000,
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["vendor-dashboard"] });
    void queryClient.invalidateQueries({ queryKey: ["restaurants"] });
    void queryClient.invalidateQueries({ queryKey: ["orders"] });
  }

  useEffect(() => {
    if (!restaurantId) return;
    const channel = supabase
      .channel(`vendor-new-order:${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "order_vendor_alerts",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["vendor-dashboard"] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["vendor-dashboard"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, restaurantId]);

  const statusMutation = useMutation({
    mutationFn: (input: { id: string; status: VendorStatus }) => updateStatus({ data: input }),
    onSuccess: () => {
      toast.success("Sipariş durumu güncellendi");
      invalidate();
    },
    onError: (error: Error) => toast.error(toPublicErrorMessage(error)),
  });

  const storeMutation = useMutation({
    mutationFn: (isOpen: boolean) => updateStore({ data: { isOpen } }),
    onSuccess: () => {
      toast.success("Mağaza durumu güncellendi");
      invalidate();
    },
    onError: (error: Error) => toast.error(toPublicErrorMessage(error)),
  });

  const itemMutation = useMutation({
    mutationFn: (input: { id: string; isAvailable: boolean }) => updateItem({ data: input }),
    onSuccess: () => {
      toast.success("Stok durumu güncellendi");
      invalidate();
    },
    onError: (error: Error) => toast.error(toPublicErrorMessage(error)),
  });

  const alertReadMutation = useMutation({
    mutationFn: (id: string) => markAlertRead({ data: { id } }),
    onSuccess: () => invalidate(),
  });

  const allAlerts = dashboard.data?.alerts ?? [];
  const unreadAlerts = allAlerts.filter((alert) => !alert.read_at);
  const notifiedAlertIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!notifiedAlertIds.current) {
      notifiedAlertIds.current = new Set(loadSeenAlertIds());
    }
    const seen = notifiedAlertIds.current;
    const ordersById = new Map((dashboard.data?.orders ?? []).map((order) => [order.id, order]));
    let changed = false;
    for (const alert of unreadAlerts) {
      if (seen.has(alert.id)) continue;
      seen.add(alert.id);
      changed = true;
      toast.success(alert.title || "Yeni sipariş", { description: alert.body });
      const order = ordersById.get(alert.order_id);
      const orderNo = alert.order_id.replace(/-/g, "").slice(0, 8);
      const title = order
        ? `Yeni sipariş #${orderNo}`
        : alert.title || `Yeni sipariş #${orderNo}`;
      const body = order
        ? [
            formatPrice(Number(order.total)),
            order.recipient_name,
            (order.order_items ?? [])
              .map((line) => `${line.quantity}x ${line.name}`)
              .join(", "),
          ]
            .filter(Boolean)
            .join(" · ")
            .slice(0, 220)
        : alert.body;
      showNativeNotification(title, body, VENDOR_ORDERS_ROUTE);
    }
    if (changed) saveSeenAlertIds(seen);
  }, [unreadAlerts, dashboard.data?.orders]);


  async function handleSignOut() {
    await unregisterMobilePushTokenOnSignOut(unregisterPushToken);
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }

  if (dashboard.isLoading) {
    return <div className="px-4 py-24 text-center text-sm text-muted-foreground">Yükleniyor…</div>;
  }

  if (dashboard.isError) {
    return (
      <AccessDenied
        autoRedirect={false}
        message={
          dashboard.error instanceof Error
            ? dashboard.error.message
            : "İşletme paneli verileri alınamadı."
        }
      />
    );
  }

  const restaurant = dashboard.data?.restaurant ?? null;
  const items = dashboard.data?.items ?? [];
  const orders = dashboard.data?.orders ?? [];
  const ordersById = new Map(orders.map((order) => [order.id, order]));
  const unreadOrderIds = new Set(unreadAlerts.map((alert) => alert.order_id));
  const activeOrders = orders.filter(
    (order) => order.status !== "delivered" && order.status !== "cancelled",
  );
  const openNow = restaurant ? isBusinessOpen(restaurant) : false;

  if (!restaurant) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16">
        <EmptyState
          title="İşletme kaydı bulunamadı"
          description="Atandığınız işletme kaldırılmış olabilir. Kurucu ile iletişime geçin."
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b border-border/70 bg-card/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-warm text-primary-foreground">
              <Store className="size-4" />
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate font-display text-sm font-semibold">{restaurant.name}</p>
              <p className="text-xs text-muted-foreground">İşletme paneli</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="rounded-full">
              <Link to="/restoran/$slug" params={{ slug: restaurant.slug }}>
                <ExternalLink className="size-4" /> Sayfamı gör
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => void handleSignOut()}
            >
              <LogOut className="size-4" /> Çıkış
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-border bg-card p-5 shadow-card">
          <div>
            <p className="font-semibold">Mağaza durumu</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {openNow ? "Şu an sipariş alıyorsunuz." : "Şu an kapalısınız, sipariş alınmıyor."}
              {restaurant.opens_at && restaurant.closes_at
                ? ` Çalışma saatleri: ${restaurant.opens_at.slice(0, 5)} – ${restaurant.closes_at.slice(0, 5)}`
                : ""}
            </p>
          </div>
          <label className="flex items-center gap-3 text-sm">
            <span className={restaurant.is_open_manual ? "font-medium" : "text-muted-foreground"}>
              {restaurant.is_open_manual ? "Açık" : "Kapalı"}
            </span>
            <Switch
              checked={restaurant.is_open_manual}
              disabled={storeMutation.isPending}
              onCheckedChange={(value) => storeMutation.mutate(value)}
              aria-label="Mağazayı açık/kapalı yap"
            />
          </label>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <StatCard label="Aktif sipariş" value={String(activeOrders.length)} />
          <StatCard label="Toplam sipariş" value={String(orders.length)} />
          <StatCard label="Ürün sayısı" value={String(items.length)} />
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            void navigate({
              to: "/vendor/dashboard",
              search: { tab: parseVendorTab(value) },
              replace: true,
            });
          }}
          className="mt-8"
        >
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
            <TabsTrigger value="siparisler">
              <ClipboardList className="size-4" /> Siparişler
            </TabsTrigger>
            <TabsTrigger value="bildirimler">
              <Bell className="size-4" /> Bildirimler
              {unreadAlerts.length > 0 ? (
                <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                  {unreadAlerts.length}
                </span>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="urunler">
              <Package className="size-4" /> Ürünler ve stok
            </TabsTrigger>
            <TabsTrigger value="gorseller">
              <ImageIcon className="size-4" /> Görseller
            </TabsTrigger>
            <TabsTrigger value="guvenlik">
              <KeyRound className="size-4" /> Şifre
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bildirimler" className="mt-6 space-y-3">
            {allAlerts.length === 0 ? (
              <EmptyState
                title="Bildirim yok"
                description="Yeni sipariş geldiğinde bildirimler burada anlık olarak listelenir."
              />
            ) : (
              allAlerts.map((alert) => {
                const order = ordersById.get(alert.order_id);
                return (
                <div
                  key={alert.id}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-3xl border p-4 ${
                    alert.read_at ? "border-border bg-card" : "border-primary/40 bg-primary/5"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {order ? order.recipient_name : alert.title || "Yeni sipariş"}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {alert.read_at ? "Okundu" : "Okunmadı"}
                      </span>
                    </p>
                    {order ? (
                      <div className="mt-1 space-y-1 text-sm text-muted-foreground">
                        <p>
                          <span className="font-medium text-foreground">{order.phone}</span>
                          {" · "}
                          Sipariş #{alert.order_id.slice(0, 8)}
                          {" · "}
                          {formatDateTime(order.created_at)}
                        </p>
                        <p>
                          {(order.order_items ?? [])
                            .map((line) => `${line.quantity}x ${line.name}`)
                            .join(", ")}
                        </p>
                        <p className="font-medium text-foreground">
                          Toplam: {formatPrice(Number(order.total))}
                        </p>
                        <p>
                          {order.street}, {order.district} / {order.city}
                        </p>
                        {order.note ? <p>Müşteri notu: {order.note}</p> : null}
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">{alert.body}</p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDateTime(alert.created_at)}
                    </p>
                  </div>
                  {alert.read_at ? null : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      disabled={alertReadMutation.isPending}
                      onClick={() => alertReadMutation.mutate(alert.id)}
                    >
                      Okundu
                    </Button>
                  )}
                </div>
                );
              })
            )}
          </TabsContent>


          <TabsContent value="siparisler" className="mt-6 space-y-3">
            {unreadAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-primary/40 bg-primary/5 p-4"
              >
                <div>
                  <p className="font-semibold">Yeni sipariş</p>
                  <p className="mt-1 text-sm text-muted-foreground">{alert.body}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  disabled={alertReadMutation.isPending}
                  onClick={() => alertReadMutation.mutate(alert.id)}
                >
                  Gördüm
                </Button>
              </div>
            ))}
            {orders.length === 0 ? (
              <EmptyState
                title="Henüz sipariş yok"
                description="Mağazanız açık olduğunda gelen siparişler burada anlık olarak listelenir."
              />
            ) : (
              orders.map((order) => (
                <div
                  key={order.id}
                  className={`rounded-3xl border bg-card p-5 shadow-card ${
                    unreadOrderIds.has(order.id) ? "border-primary/50" : "border-border"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{order.recipient_name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDateTime(order.created_at)} · {order.phone}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {order.street}, {order.district} / {order.city}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatPrice(Number(order.total))}</p>
                      <p className="text-xs text-muted-foreground">
                        {ORDER_STATUS_LABELS[order.status] ?? order.status}
                      </p>
                    </div>
                  </div>

                  {order.status === "cancelled" ? null : (
                    <div className="mt-4 flex gap-1.5" aria-hidden>
                      {ORDER_TRACK_STEPS.map((step, index) => (
                        <span
                          key={step.label}
                          className={`h-1.5 flex-1 rounded-full ${
                            index <= orderStepIndex(order.status) ? "bg-primary" : "bg-border"
                          }`}
                        />
                      ))}
                    </div>
                  )}

                  {(order.order_items ?? []).length === 0 ? (
                    <p className="mt-4 text-xs text-muted-foreground">Ürün bilgisi bulunamadı.</p>
                  ) : (
                    <ul className="mt-4 space-y-1 text-sm">
                      {(order.order_items ?? []).map((line) => (
                        <li key={line.id} className="flex justify-between gap-3">
                          <span className="truncate">
                            {line.quantity}× {line.name}
                          </span>
                          <span className="text-muted-foreground">
                            {formatPrice(Number(line.unit_price) * line.quantity)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {order.note ? (
                    <p className="mt-3 rounded-2xl bg-muted/60 p-3 text-xs text-muted-foreground">
                      Not: {order.note}
                    </p>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {VENDOR_STATUS_FLOW.map((step) => (
                      <Button
                        key={step.value}
                        size="sm"
                        variant={order.status === step.value ? "secondary" : "outline"}
                        className="rounded-full"
                        disabled={statusMutation.isPending || order.status === step.value}
                        onClick={() =>
                          statusMutation.mutate({ id: order.id, status: step.value })
                        }
                      >
                        {step.label}
                      </Button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="urunler" className="mt-6">
            <ProductPanel
              items={items as never}
              categories={dashboard.data?.categories ?? []}
              onChanged={invalidate}
            />
            {items.length > 0 ? (
              <div className="mt-6 overflow-hidden rounded-3xl border border-border bg-card">
                <p className="border-b border-border/60 p-4 text-sm font-semibold">
                  Hızlı stok durumu
                </p>
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 p-4 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatPrice(Number(item.price))}
                      </p>
                    </div>
                    <label className="flex items-center gap-3 text-sm">
                      <span
                        className={item.is_available ? "font-medium" : "text-muted-foreground"}
                      >
                        {item.is_available ? "Stokta var" : "Stokta yok"}
                      </span>
                      <Switch
                        checked={item.is_available}
                        disabled={itemMutation.isPending}
                        onCheckedChange={(value) =>
                          itemMutation.mutate({ id: item.id, isAvailable: value })
                        }
                        aria-label={`${item.name} stok durumu`}
                      />
                    </label>
                  </div>
                ))}
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="gorseller" className="mt-6">
            <MediaPanel
              logoUrl={restaurant.logo_url ?? null}
              coverUrl={restaurant.cover_image_url ?? null}
              media={dashboard.data?.media ?? []}
              onChanged={invalidate}
            />
          </TabsContent>


          <TabsContent value="guvenlik" className="mt-6">
            <PasswordPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function PasswordPanel() {
  const change = useServerFn(changeVendorPassword);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");

  const mutation = useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) =>
      change({ data: input }),
    onSuccess: () => {
      toast.success("Şifreniz güncellendi.");
      setCurrentPassword("");
      setNewPassword("");
      setRepeatPassword("");
    },
    onError: (error: Error) => toast.error(toPublicErrorMessage(error)),
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (newPassword !== repeatPassword) {
          toast.error("Yeni şifreler birbiriyle eşleşmiyor.");
          return;
        }
        mutation.mutate({ currentPassword, newPassword });
      }}
      className="max-w-md space-y-4 rounded-3xl border border-border bg-card p-6 shadow-card"
    >
      <div>
        <p className="font-semibold">Şifre değiştir</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Mevcut şifreniz doğrulandıktan sonra yeni şifreniz kaydedilir. Şifrenizi belirledikten
          sonra telefon + tek kullanımlık kod ile girmeye devam edebilirsiniz.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="current-password">Mevcut şifre</Label>
        <Input
          id="current-password"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          required
          className="rounded-xl"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-password">Yeni şifre</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          required
          className="rounded-xl"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="repeat-password">Yeni şifre (tekrar)</Label>
        <Input
          id="repeat-password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={repeatPassword}
          onChange={(event) => setRepeatPassword(event.target.value)}
          required
          className="rounded-xl"
        />
      </div>
      <Button type="submit" disabled={mutation.isPending} className="w-full rounded-full">
        {mutation.isPending ? "Kaydediliyor…" : "Şifreyi güncelle"}
      </Button>
    </form>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
