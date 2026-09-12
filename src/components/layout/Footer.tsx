import { Link } from "@tanstack/react-router";
import { useSiteSettings } from "@/hooks/useSiteSettings";

export function Footer() {
  const { settings, footer } = useSiteSettings();
  return (
    <footer className="mt-20 border-t border-border/70 bg-secondary/60 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2">
        <div>
          <p className="font-display text-lg font-semibold">{settings.brand_name}</p>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">{footer.footer_tagline}</p>
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
              <Link
                to="/hesabim"
                search={{ sekme: "siparisler" }}
                className="transition-colors hover:text-foreground"
              >
                Siparişlerim
              </Link>
            </li>
            <li>
              <Link to="/isletme-basvuru" className="transition-colors hover:text-foreground">
                İşletme başvurusu
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/70 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {settings.brand_name}. Tüm hakları saklıdır. ·{" "}
        <Link to="/kullanim-kosullari" className="underline-offset-4 hover:underline">
          Kullanım Koşulları
        </Link>
        {" · "}
        <Link to="/gizlilik-politikasi" className="underline-offset-4 hover:underline">
          Gizlilik Politikası
        </Link>
        {" · "}
        <Link to="/kvkk" className="underline-offset-4 hover:underline">
          KVKK Aydınlatma Metni
        </Link>
        {" · "}
        <Link to="/iptal-ve-iade" className="underline-offset-4 hover:underline">
          İptal ve İade
        </Link>
        {" · "}
        <Link to="/hizmet-saglayici-bilgileri" className="underline-offset-4 hover:underline">
          Hizmet Sağlayıcı Bilgileri
        </Link>
      </div>
    </footer>
  );
}
