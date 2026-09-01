import { Link } from "@tanstack/react-router";
import { areaLabel, useServiceAreas } from "@/hooks/useTaxonomy";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { APK_DOWNLOAD, APK_URL } from "@/lib/android-apk";

export function Footer() {
  const { areas } = useServiceAreas();
  const { settings, footer } = useSiteSettings();
  const areaText = areas.length > 0 ? areas.map(areaLabel).join(" · ") : "Bölgeler yakında";
  return (
    <footer className="mt-20 border-t border-border/70 bg-secondary/60 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3">
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
              <Link to="/siparislerim" className="transition-colors hover:text-foreground">
                Siparişlerim
              </Link>
            </li>
            <li>
              <a
                href={APK_URL}
                download={APK_DOWNLOAD}
                className="transition-colors hover:text-foreground"
              >
                Android uygulamasını indir
              </a>
            </li>
            <li>
              <Link to="/iphone" className="transition-colors hover:text-foreground">
                iPhone’a kur
              </Link>
            </li>
          </ul>
        </div>
        <div className="text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">Teslimat saatleri</p>
          <p className="mt-3">{footer.footer_delivery_hours}</p>
          <p className="mt-1" suppressHydrationWarning>
            {areaText}
          </p>
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
        {" · "}
        <Link to="/hesabim" className="underline-offset-4 hover:underline">
          Hesabımı Sil
        </Link>
        {" · "}
        <Link to="/kurucu-giris" className="underline-offset-4 hover:underline">
          Sayfa yöneticisi girişi
        </Link>
      </div>
    </footer>
  );
}
