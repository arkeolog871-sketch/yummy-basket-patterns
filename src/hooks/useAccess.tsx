import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import { getMyAccessContext } from "@/lib/vendor.functions";

export type AccessRole = "founder" | "vendor" | "customer" | "guest";

/** Rol tabanlı yönlendirme ve panel korumaları için tek doğruluk kaynağı. */
export function useAccess() {
  const { user, loading } = useAuth();
  const fetchAccess = useServerFn(getMyAccessContext);

  const query = useQuery({
    queryKey: ["access-context", user?.id ?? "anon"],
    enabled: Boolean(user),
    queryFn: () => fetchAccess(),
    staleTime: 5_000,
    refetchOnWindowFocus: true,
  });

  const role: AccessRole = !user ? "guest" : (query.data?.role ?? "customer");

  const homePath: "/kurucu" | "/vendor/dashboard" | "/" = query.data?.isFounder
    ? "/kurucu"
    : query.data?.isVendor
      ? "/vendor/dashboard"
      : "/";

  return {
    loading: loading || (Boolean(user) && query.isLoading),
    role,
    isFounder: query.data?.isFounder ?? false,
    isVendor: query.data?.isVendor ?? false,
    emailVerified: query.data?.emailVerified ?? false,
    restaurantId: query.data?.restaurantId ?? null,
    /** Rolün varsayılan giriş sonrası hedefi. */
    homePath,
  };
}
