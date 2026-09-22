import { Link, useCanGoBack, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getUnreadNotificationCount } from "@/lib/notifications.functions";
import { useEffect, useState } from "react";
import {
  ShoppingBag,
  UtensilsCrossed,
  User,
  LogOut,
  MapPin,
  Search,
  ChevronDown,
  ChevronLeft,
  Crown,
  Store,
  Bell,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAccess } from "@/hooks/useAccess";
import { isIosNativeShell } from "@/lib/native-shell";
import { useCart } from "@/hooks/useCart";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useServiceAreas, areaLabel } from "@/hooks/useTaxonomy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TextPrefsPanel } from "@/components/layout/TextPrefsPanel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Header() {
  // Kabuk tespiti sunucuda yapılamaz (window yok) ve ilk boyamada hatalı
  // sınıf basmamak için efektte okunuyor. Kusur dokunmada ortaya çıkıyor;
  // kullanıcı dokunana kadar efekt çoktan çalışmış oluyor.
  const [iosShell, setIosShell] = useState(false);
  useEffect(() => {
    setIosShell(isIosNativeShell());
  }, []);

  const { user } = useAuth();
  const { itemCount } = useCart();
  const { settings } = useSiteSettings();
  const access = useAccess();
  const { areas } = useServiceAreas();
  const navigate = useNavigate();
  // iOS'ta donanım geri tuşu yok; kabuğun kendi geri hareketi de kapalı.
  // Yığında gerçekten geri gidilecek bir adım varsa düğme çizilir.
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const queryClient = useQueryClient();
  const fetchUnread = useServerFn(getUnreadNotificationCount);
  const { data: unread } = useQuery({
    queryKey: ["notifications-unread"],
    queryFn: () => fetchUnread(),
    enabled: Boolean(user),
    refetchInterval: 30000,
  });
  const unreadCount = user ? (unread?.count ?? 0) : 0;
  const [city, setCity] = useState<string>("");
  const [hydrated, setHydrated] = useState(false);
  const [term, setTerm] = useState("");
  // Ana sayfada hero bölümünde zaten büyük bir arama çubuğu var. Mobilde
  // üst çubuktaki arama ayrı bir satıra düşüyor ve ikisi alt alta iki arama
  // çubuğu gibi görünüyordu; mobilde ana sayfada üstteki gizlenir.
  const isHome = useRouterState({ select: (state) => state.location.pathname === "/" });
  const areaOptions = areas.map(areaLabel);
  const activeCity = (hydrated && city) || areaOptions[0] || "Bölge seçin";

  useEffect(() => {
    setHydrated(true);
    const saved = window.localStorage.getItem("teslimat-bolgesi");
    if (saved) setCity(saved);
  }, []);

  function selectCity(value: string) {
    setCity(value);
    window.localStorage.setItem("teslimat-bolgesi", value);
  }

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    // iOS'ta başlık YAPIŞKAN DEĞİL, bilerek.
    //
    // WKWebView'de `position: sticky` bir öğe kendi derleme katmanına
    // taşınıyor ve o katmanın dokunma bölgesi ilk boyamada kurulmuyor:
    // başlık görünüyor ama düğmeleri dokunuşa cevap vermiyor. Sayfa birazcık
    // kaydırılınca katman tazeleniyor ve düğmeler çalışmaya başlıyor.
    //
    // Daha önce bunu yarı saydamlığı (backdrop-blur) kaldırarak çözmeyi
    // denedim; katmanın tek sebebi o değilmiş, kusur cihazda geri geldi.
    // Sebebi azaltmak yerine mekanizmayı kaldırmak gerekiyor: iOS kabuğunda
    // başlık akışta duruyor, yani ortada tazelenecek bir katman yok.
    //
    // Tarayıcı ve Android bundan etkilenmiyor; onlarda yapışkan başlık
    // olduğu gibi kalıyor.
    <header
      data-app-header
      className={`z-40 border-b border-border/70 bg-background pt-[env(safe-area-inset-top)] ${
        iosShell ? "" : "sticky top-0"
      }`}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
        {/*
          Geri düğmesi YALNIZCA iOS kabuğunda çizilir. Tarayıcının kendi geri
          tuşu, Android'in donanım/hareket geri tuşu var; iOS kabuğunda ise
          hiçbiri yok, kullanıcı bir alt sayfada sıkışıp kalıyordu.

          Düğme akışın içinde duruyor, sabitlenmiyor: WKWebView'de `fixed` ve
          `sticky` öğeler kendi derleme katmanına taşınıp ilk boyamada dokunma
          bölgesini kurmuyor (başlığın yapışkanlığını bu yüzden kaldırdık).
          Aynı kusuru yeni bir düğmeyle geri getirmenin anlamı yok.
        */}
        {iosShell && canGoBack ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Geri"
            className="-ml-1 shrink-0 rounded-full"
            onClick={() => router.history.back()}
          >
            <ChevronLeft className="size-5" />
          </Button>
        ) : null}

        <Link to="/" className="flex items-center gap-2">
          {settings.logo_url ? (
            <img
              src={settings.logo_url}
              alt={`${settings.brand_name} logosu`}
              className="size-9 rounded-2xl object-cover"
            />
          ) : (
            <span className="flex size-9 items-center justify-center rounded-2xl bg-gradient-warm text-primary-foreground shadow-glow">
              <UtensilsCrossed className="size-5" />
            </span>
          )}
          <span className="font-display text-lg font-semibold tracking-tight">
            {settings.brand_name}
          </span>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="rounded-full px-3 text-sm">
              <MapPin className="size-4 text-accent" />
              <span className="max-w-[9rem] truncate" suppressHydrationWarning>
                {activeCity}
              </span>
              <ChevronDown className="size-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Teslimat bölgesi
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={activeCity} onValueChange={selectCity}>
              {areaOptions.map((option) => (
                <DropdownMenuRadioItem key={option} value={option}>
                  {option}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            {areaOptions.length === 0 ? (
              <p className="px-2 py-2 text-xs text-muted-foreground">
                Henüz teslimat bölgesi tanımlanmadı. Sayfa yöneticisi panelinden ekleyebilirsiniz.
              </p>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>

        <form
          className={`order-last w-full min-w-0 flex-1 sm:order-none sm:w-auto${
            isHome ? " hidden sm:block" : ""
          }`}
          onSubmit={(event) => {
            event.preventDefault();
            navigate({
              to: "/",
              search: (prev) => {
                const kategori = typeof prev.kategori === "string" ? prev.kategori : undefined;
                const q = term.trim() || undefined;
                return {
                  ...(kategori ? { kategori } : {}),
                  ...(q ? { q } : {}),
                };
              },
            });
          }}
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="İşletme, mutfak veya ürün ara"
              aria-label="İşletme ara"
              className="h-10 rounded-full bg-card pl-9"
            />
          </div>
        </form>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <TextPrefsPanel />
          <Button asChild variant="secondary" className="relative rounded-full">
            <Link to="/sepet">
              <ShoppingBag className="size-4" />
              <span className="hidden sm:inline">Sepet</span>
              {itemCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground">
                  {itemCount}
                </span>
              ) : null}
            </Link>
          </Button>
          {/*
            Bildirimler düğmesi bilerek sıcak tonda: marka rengi kurucu
            panelinden geliyor (`--warm`) ve metin kontrastı warm-contrast
            ile otomatik seçiliyor, o yüzden koyu bir warm seçilse de yazı
            okunur kalıyor. Sepet ikincil tonda kalıyor ki ikisi ayrışsın.
          */}
          <Button
            asChild
            variant="secondary"
            className="relative rounded-full bg-warm text-warm-foreground hover:bg-warm/85"
          >
            <Link to="/bildirimler" aria-label="Bildirimler">
              <Bell className="size-4" />
              <span className="hidden sm:inline">Bildirimler</span>
              {unreadCount > 0 ? (
                // Rozet, düğmenin sıcak tonunun TERSİ: açık zemin + sıcak renkte
                // sayı. warm ve warm-foreground warm-contrast ile zıt seçildiği
                // için hangi marka rengi seçilirse seçilsin sayı okunur kalıyor;
                // düğmenin kendisi tek renk olduğundan ters rozet üstünde belirgin
                // duruyor. İnce sıcak halka, açık rozeti krem sayfa üstünde de ayırıyor.
                <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-warm-foreground px-1 text-[11px] font-bold text-warm ring-2 ring-warm">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </Link>
          </Button>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-full" aria-label="Hesabım">
                  <User className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
                  {user.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/hesabim">
                    <User className="size-4" /> Hesabım
                  </Link>
                </DropdownMenuItem>
                {access.isVendor ? (
                  <DropdownMenuItem asChild>
                    <Link to="/vendor/dashboard">
                      <Store className="size-4" /> İşletme paneli
                    </Link>
                  </DropdownMenuItem>
                ) : null}
                {access.canManagePage ? (
                  <DropdownMenuItem asChild>
                    <Link to="/kurucu">
                      <Crown className="size-4" /> Sayfa yöneticisi paneli
                    </Link>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void handleSignOut()}>
                  <LogOut className="size-4" /> Çıkış yap
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild className="rounded-full">
              <Link to="/auth">Giriş yap</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
