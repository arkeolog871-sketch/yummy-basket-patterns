import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Store, LogOut, ClipboardList, Package, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { EmptyState } from "@/components/vendor/EmptyState";
import { useAccess } from "@/hooks/useAccess";
import {
  getVendorDashboard,
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/vendor/dashboard")({
  head: () => ({
    meta: [
      { title: "İşletme Paneli — SofraKapımda" },
      {
        name: "description",
        content:
          "İşletme paneli: kendi siparişlerinizi takip edin, teslimat durumunu güncelleyin, stok ve mağaza durumunu yönetin.",
      },
      { property: "og:title", content: "İşletme Paneli — SofraKapımda" },
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
  const { loading, isVendor, isFounder } = useAccess();

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

  return <VendorDashboard />;
}

function VendorDashboard() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const fetchDashboard = useServerFn(getVendorDashboard);
  const updateStatus = useServerFn(setVendorOrderStatus);
  const updateStore = useServerFn(setVendorStoreOpen);
  const updateItem = useServerFn(setVendorItemAvailability);

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

  const statusMutation = useMutation({
    mutationFn: (input: { id: string; status: VendorStatus }) => updateStatus({ data: input }),
    onSuccess: () => {
      toast.success("Sipariş durumu güncellendi");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const storeMutation = useMutation({
    mutationFn: (isOpen: boolean) => updateStore({ data: { isOpen } }),
    onSuccess: () => {
      toast.success("Mağaza durumu güncellendi");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const itemMutation = useMutation({
    mutationFn: (input: { id: string; isAvailable: boolean }) => updateItem({ data: input }),
    onSuccess: () => {
      toast.success("Stok durumu güncellendi");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function handleSignOut() {
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

        <Tabs defaultValue="siparisler" className="mt-8">
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
            <TabsTrigger value="siparisler">
              <ClipboardList className="size-4" /> Siparişler
            </TabsTrigger>
            <TabsTrigger value="urunler">
              <Package className="size-4" /> Ürünler ve stok
            </TabsTrigger>
          </TabsList>

          <TabsContent value="siparisler" className="mt-6 space-y-3">
            {orders.length === 0 ? (
              <EmptyState
                title="Henüz sipariş yok"
                description="Mağazanız açık olduğunda gelen siparişler burada anlık olarak listelenir."
              />
            ) : (
              orders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-3xl border border-border bg-card p-5 shadow-card"
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
            {items.length === 0 ? (
              <EmptyState
                title="Henüz ürün eklenmemiş"
                description="Menünüze ürün eklenmesi için kurucu ile iletişime geçin; ürünler eklendiğinde stok durumunu buradan yönetebilirsiniz."
                icon={<Package className="size-5" />}
              />
            ) : (
              <div className="overflow-hidden rounded-3xl border border-border bg-card">
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
                        className={
                          item.is_available ? "font-medium" : "text-muted-foreground"
                        }
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
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
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
