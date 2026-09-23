import { Link } from "@tanstack/react-router";
import { Store } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Ana sayfanın altındaki çağrı: işletme başvurusu. Burada eskiden sayfa
 * yöneticisinin telefon ve e-postası vardı; iletişim bilgileri alt bilgideki
 * Keşfet → İletişim altına taşındı (kullanıcı isteği).
 */
export function BusinessApplyCta() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-16">
      <div className="flex flex-col gap-5 rounded-3xl border border-primary/25 bg-primary/5 p-6 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:p-10">
        <div className="max-w-xl">
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            İşletme başvurusu
          </h2>
          <p className="font-display mt-2 text-2xl font-bold leading-tight sm:text-3xl">
            İşletmenizi platforma ekleyin
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Menünüzü, ürünlerinizi ve siparişlerinizi tek panelden yönetin; mahallenizdeki
            müşterilere ulaşın.
          </p>
        </div>
        <Button
          asChild
          size="lg"
          className="h-12 min-h-12 shrink-0 rounded-full px-6 text-base shadow-glow"
        >
          <Link to="/isletme-basvuru" className="touch-manipulation">
            <Store className="size-5" />
            Başvuru yap
          </Link>
        </Button>
      </div>
    </section>
  );
}
