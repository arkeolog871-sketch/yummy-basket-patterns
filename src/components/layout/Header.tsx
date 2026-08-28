import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ShoppingBag,
  UtensilsCrossed,
  User,
  LogOut,
  MapPin,
  ClipboardList,
  Search,
  ChevronDown,
  Crown,
  Store,
  Bell,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAccess } from "@/hooks/useAccess";
import { useCart } from "@/hooks/useCart";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useAppCategories, useServiceAreas, areaLabel } from "@/hooks/useTaxonomy";
import { useNotificationBridge } from "@/hooks/useNotificationBridge";
import { useServerFn } from "@tanstack/react-start";
import { unregisterDevicePushToken } from "@/lib/vendor-mobile-notification.functions";
import { unregisterMobilePushTokenOnSignOut } from "@/lib/vendor-mobile-notification";
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
  const { user } = useAuth();
  const { itemCount } = useCart();
  const { settings, isFounder, founderExists } = useSiteSettings();
  const access = useAccess();
  const { unreadCount } = useNotificationBridge();
  const { categories } = useAppCategories();
  const { areas } = useServiceAreas();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const unregisterPushToken = useServerFn(unregisterDevicePushToken);
  const [city, setCity] = useState<string>("");
  const [hydrated, setHydrated] = useState(false);
  const [term, setTerm] = useState("");
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
    await unregisterMobilePushTokenOnSignOut(unregisterPushToken);
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
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
                Henüz teslimat bölgesi tanımlanmadı. Kurucu panelinden ekleyebilirsiniz.
              </p>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>

        <form
          className="order-last w-full min-w-0 flex-1 sm:order-none sm:w-auto"
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
          {user ? (
            <Button asChild variant="outline" size="icon" className="relative rounded-full" aria-label="Bildirimler">
              <Link to="/bildirimler">
                <Bell className="size-4" />
                {unreadCount > 0 ? (
                  <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                ) : null}
              </Link>
            </Button>
          ) : null}
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
                  <Link to="/bildirimler">
                    <Bell className="size-4" /> Bildirimler
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/siparislerim">
                    <ClipboardList className="size-4" /> Siparişlerim
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/adreslerim">
                    <MapPin className="size-4" /> Adreslerim
                  </Link>
                </DropdownMenuItem>
                {access.isVendor ? (
                  <DropdownMenuItem asChild>
                    <Link to="/vendor/dashboard">
                      <Store className="size-4" /> İşletme paneli
                    </Link>
                  </DropdownMenuItem>
                ) : null}
                {isFounder || (!founderExists && !access.isVendor) ? (
                  <DropdownMenuItem asChild>
                    <Link to="/kurucu">
                      <Crown className="size-4" /> Kurucu paneli
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

      <nav
        aria-label="Kategoriler"
        className="no-scrollbar mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto border-t border-border/60 px-4 py-2"
      >
        {categories.map((sector) => (
          <Link
            key={sector.slug}
            to="/"
            search={{ kategori: sector.slug }}
            activeOptions={{ exact: true, includeSearch: true }}
            className="shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-warm hover:text-warm-foreground"
            activeProps={{
              className: "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium text-foreground",
            }}
          >
            {sector.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
