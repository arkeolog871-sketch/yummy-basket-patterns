import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Adres yönetimi artık Hesabım sayfasının bir sekmesi. Bu rota, mevcut
 * bağlantılar (ör. ödeme sayfasındaki "Adres ekle") ve yer imleri için
 * korunuyor.
 */
export const Route = createFileRoute("/adreslerim")({
  beforeLoad: () => {
    throw redirect({ to: "/hesabim", search: { sekme: "adresler" } });
  },
});
