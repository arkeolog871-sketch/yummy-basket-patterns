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
import { brandLogoSrc } from "@/lib/brand-logo";
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
      className={`z-40 shrink-0 border-b border-border/70 bg-background pt-[env(safe-area-inset-top)] ${
        iosShell ? "" : "sticky top-0"
      }`}
    >
      {/*
        Mobilde başlık TEK satır: [logo simgesi · bölge · tuşlar]. Başlık
        uygulamada sabit durduğu için ekranın ne kadarını kapladığı önemli:
        önce 157px (üç satır), sonra 97px (iki satır) idi; kullanıcı üçte bir
        daha azaltılmasını istedi. Marka yazısı yalnız masaüstünde görünüyor,
        telefonda logo simgesi marka yerine geçiyor. Arama çubuğu (ana sayfa
        dışında) ayrı satıra iner.
      */}
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-1.5 gap-y-2 px-4 py-2 min-[380px]:gap-x-2 sm:gap-3 sm:py-3">
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

        <Link
          to="/"
          className="flex shrink-0 items-center gap-2"
          aria-label={`${settings.brand_name} ana sayfa`}
        >
          {settings.logo_url ? (
            // Amblem YATAY (pelerinli S) ama dosya 512x512 kare: amblem
            // genişliğin %89'unu, yüksekliğin yalnız %62'sini kaplıyor; üstte
            // ve altta krem boşluk var. Kare kutuda ~28x20px görünüyordu.
            // Yatay kutu + object-cover o boş şeritleri kırpar, amblem satır
            // yüksekliğini değiştirmeden neredeyse iki kat büyür. Zemin
            // başlıkla aynı krem olduğu için köşe yuvarlatmasına gerek yok.
            // Varsayılan amblemin zemini saydam sürümü kullanılır: koyu
            // temada krem kutu olarak görünmesin (bkz. brandLogoSrc).
            <img
              src={brandLogoSrc(settings.logo_url)}
              alt={`${settings.brand_name} logosu`}
              className="h-9 w-[3.25rem] object-cover min-[380px]:w-[3.5rem] sm:h-10 sm:w-16"
            />
          ) : (
            <span className="flex size-8 items-center justify-center rounded-2xl bg-gradient-warm text-primary-foreground shadow-glow sm:size-9">
              <UtensilsCrossed className="size-5" />
            </span>
          )}
          <span className="hidden font-display text-lg font-semibold tracking-tight sm:inline">
            {settings.brand_name}
          </span>
        </Link>

        {/* Mobilde bölge logonun yanında, kalan yeri doldurur (taban
            genişliği 0) ve sığmazsa adı kısaltılır; tuşları sağa iter. */}
        <div className="flex min-w-0 flex-1 sm:flex-none">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="min-w-0 max-w-full gap-1 rounded-full px-1 text-sm min-[380px]:px-1.5 sm:gap-2 sm:px-3"
              >
                {/* Ana renk (primary): vurgu rengi (accent) kurucu panelinden
                    geliyor ve canlıda başlık zemininin AYNISI (#f4edda) seçilmiş;
                    simge krem üstünde krem kalıp görünmüyordu. Ana renk tuşlarda
                    kullanıldığı için zeminden her zaman ayrışır. */}
                <MapPin className="size-4 text-primary" />
                {/* Mobilde yalnızca ilçe: "SİLVAN, DİYAR…" diye kesilmesin. Tam ad
                  masaüstünde ve açılır menüde. */}
                <span className="min-w-0 truncate sm:hidden" suppressHydrationWarning>
                  {activeCity.split(",")[0]}
                </span>
                <span className="hidden max-w-[9rem] truncate sm:inline" suppressHydrationWarning>
                  {activeCity}
                </span>
                <ChevronDown className="hidden size-3.5 opacity-60 sm:block" />
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
        </div>

        <form
          className={`order-last w-full min-w-0 basis-full sm:order-none sm:w-auto sm:flex-1 sm:basis-0${
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
              className="h-9 rounded-full bg-card pl-9 sm:h-10"
            />
          </div>
        </form>

        {/* Tuşlar logonun satırında, sağda. Mobilde sepet ve bildirim
            yalnız simge (36px), masaüstünde yazılı. */}
        {/* 380px'ten dar telefonlarda aralıklar biraz sıkı: 360px'te bölge
            adı 15px eksik kalıp "SİL…" diye kesiliyordu (ölçüldü). */}
        <div className="flex shrink-0 items-center gap-2 min-[380px]:gap-2.5 sm:ml-auto sm:gap-2">
          <TextPrefsPanel />
          <Button
            asChild
            variant="secondary"
            className="relative w-9 rounded-full px-0 sm:w-auto sm:px-4"
          >
            <Link to="/sepet" aria-label="Sepet">
              <ShoppingBag className="size-4" />
              <span className="hidden sm:inline">Sepet</span>
              {itemCount > 0 ? (
                // Ana renk: vurgu rengi zeminle aynı seçildiğinde sayı
                // (krem zemin, beyaza yakın yazı) okunmuyordu.
                <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
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
            className="relative w-9 rounded-full bg-warm px-0 text-warm-foreground hover:bg-warm/85 sm:w-auto sm:px-4"
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
            <Button asChild className="rounded-full px-3 sm:px-4">
              <Link to="/auth">
                <span className="sm:hidden">Giriş</span>
                <span className="hidden sm:inline">Giriş yap</span>
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
