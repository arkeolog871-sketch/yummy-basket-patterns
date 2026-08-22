import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMapsBrowserKey } from "@/lib/maps.functions";

/** Harita tarayıcı anahtarını sunucudan alır (tabloda herkese açık değil). */
export function useMapsKey() {
  const fetchKey = useServerFn(getMapsBrowserKey);
  const query = useQuery({
    queryKey: ["maps-browser-key"],
    queryFn: () => fetchKey(),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  return { mapsApiKey: query.data?.key ?? null, isLoading: query.isLoading };
}
