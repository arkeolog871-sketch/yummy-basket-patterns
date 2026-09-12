import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Sipariş geçmişi artık Hesabım sayfasının bir sekmesi. Bu rota, mevcut
 * bağlantılar ve kullanıcıların yer imleri için korunuyor.
 */
export const Route = createFileRoute("/siparislerim")({
  beforeLoad: () => {
    throw redirect({ to: "/hesabim", search: { sekme: "siparisler" } });
  },
});
