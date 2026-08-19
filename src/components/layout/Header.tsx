import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ShoppingBag, UtensilsCrossed, User, LogOut, MapPin, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const { user } = useAuth();
  const { itemCount } = useCart();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-2xl bg-gradient-warm text-primary-foreground shadow-glow">
            <UtensilsCrossed className="size-5" />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">SofraKapımda</span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 text-sm md:flex">
          <Link
            to="/restoranlar"
            className="rounded-full px-3 py-2 text-muted-foreground transition-colors hover:bg-warm hover:text-warm-foreground"
            activeProps={{ className: "rounded-full px-3 py-2 bg-warm text-warm-foreground" }}
          >
            Restoranlar
          </Link>
          {user ? (
            <Link
              to="/siparislerim"
              className="rounded-full px-3 py-2 text-muted-foreground transition-colors hover:bg-warm hover:text-warm-foreground"
              activeProps={{ className: "rounded-full px-3 py-2 bg-warm text-warm-foreground" }}
            >
              Siparişlerim
            </Link>
          ) : null}
        </nav>

        <div className="ml-auto flex items-center gap-2">
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
                  <Link to="/siparislerim">
                    <ClipboardList className="size-4" /> Siparişlerim
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/adreslerim">
                    <MapPin className="size-4" /> Adreslerim
                  </Link>
                </DropdownMenuItem>
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