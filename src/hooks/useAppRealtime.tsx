import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const CATALOG_KEYS = [
  ["home-businesses"],
  ["restaurants"],
  ["restaurant"],
  ["categories"],
  ["app-categories"],
  ["service-areas"],
  ["vendor-dashboard"],
  ["admin-data"],
] as const;

const MEMBERSHIP_KEYS = [["access-context"], ["my-roles"], ["admin-users"], ["admin-data"]] as const;

const ORDER_KEYS = [["orders"], ["order"], ["vendor-dashboard"], ["admin-data"]] as const;

const LIVE_KEYS = [
  ...CATALOG_KEYS,
  ...MEMBERSHIP_KEYS,
  ...ORDER_KEYS,
  ["site-settings"],
  ["addresses"],
  ["maps-browser-key"],
  ["maps-key-status"],
] as const;

function invalidateAll(
  queryClient: ReturnType<typeof useQueryClient>,
  keys: readonly (readonly string[])[],
) {
  for (const queryKey of keys) {
    void queryClient.invalidateQueries({ queryKey: [...queryKey], refetchType: "active" });
  }
}

function refreshLiveState(queryClient: ReturnType<typeof useQueryClient>) {
  invalidateAll(queryClient, LIVE_KEYS);
}

/** Üyelik, katalog, sipariş ve ayar değişikliklerini anında yansıtır. */
export function AppRealtimeBridge() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const subscribed = useRef(false);

  useEffect(() => {
    const channel = supabase
      .channel("app-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "restaurants" }, () => {
        invalidateAll(queryClient, CATALOG_KEYS);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, () => {
        invalidateAll(queryClient, CATALOG_KEYS);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_categories" }, () => {
        invalidateAll(queryClient, CATALOG_KEYS);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "app_categories" }, () => {
        invalidateAll(queryClient, CATALOG_KEYS);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "service_areas" }, () => {
        invalidateAll(queryClient, CATALOG_KEYS);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "site_settings" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["site-settings"], refetchType: "active" });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () => {
        invalidateAll(queryClient, MEMBERSHIP_KEYS);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "vendor_assignments" }, () => {
        invalidateAll(queryClient, MEMBERSHIP_KEYS);
        invalidateAll(queryClient, CATALOG_KEYS);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        invalidateAll(queryClient, ORDER_KEYS);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => {
        invalidateAll(queryClient, ORDER_KEYS);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "addresses" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["addresses"], refetchType: "active" });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        invalidateAll(queryClient, MEMBERSHIP_KEYS);
      })
      .subscribe((status) => {
        subscribed.current = status === "SUBSCRIBED";
        if (status === "SUBSCRIBED") refreshLiveState(queryClient);
      });

    const fallbackMs = () => (subscribed.current ? 20_000 : 8_000);
    let timer = window.setTimeout(function tick() {
      refreshLiveState(queryClient);
      timer = window.setTimeout(tick, fallbackMs());
    }, 4_000);

    const onVisible = () => {
      if (document.visibilityState === "visible") refreshLiveState(queryClient);
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
      subscribed.current = false;
      void supabase.removeChannel(channel);
    };
  }, [queryClient, user?.id]);

  return null;
}
