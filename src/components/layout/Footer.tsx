import { Link } from "@tanstack/react-router";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-border/70 bg-secondary/60">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3">
        <div>
          <p className="font-display text-lg font-semibold">SofraKapımda</p>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            Mahallenin en iyi ustalarından sıcak yemekler, kapınıza kadar.
          </p>
        </div>
        <div className="text-sm">
          <p className="font-semibold">Keşfet</p>
          <ul className="mt-3 space-y-2 text-muted-foreground">
            <li>
              <Link to="/restoranlar" className="transition-colors hover:text-foreground">
                Tüm restoranlar
              </Link>
            </li>
            <li>
              <Link to="/sepet" className="transition-colors hover:text-foreground">
                Sepetim
              </Link>
            </li>
            <li>
              <Link to="/siparislerim" className="transition-colors hover:text-foreground">
                Siparişlerim
              </Link>
            </li>
          </ul>
        </div>
        <div className="text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">Teslimat saatleri</p>
          <p className="mt-3">Her gün 10:00 – 23:30</p>
          <p className="mt-1">İstanbul, Ankara, İzmir</p>
        </div>
      </div>
      <div className="border-t border-border/70 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} SofraKapımda. Tüm hakları saklıdır.
      </div>
    </footer>
  );
}