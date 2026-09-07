import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      // Menü/kategori/restoran listesi gibi veriler saniyeler içinde değişmiyor;
      // her sayfa geçişinde/yeniden yüklemede ağdan tekrar çekmek yerine bir süre
      // önbellekten anında göster — mutasyonlar zaten ilgili sorguları elle
      // invalidate ediyor, bu yüzden gerçek zamanlı akışlar (sipariş durumu vb.)
      // etkilenmiyor.
      queries: { staleTime: 60_000 },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Bağlantı üzerine gelinir gelinmez (tıklamadan önce) veriyi önceden çekmeye
    // başla — gezinme neredeyse anında hissettirir.
    defaultPreload: "intent",
    defaultPreloadStaleTime: 30_000,
  });

  return router;
};
