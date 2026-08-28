import { useEffect } from "react";
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

const ORDER_KEYS = [
  ["orders"],
  ["order"],
  ["vendor-dashboard"],
  ["admin-data"],
  ["notifications"],
  ["notification-unread-count"],
] as const;

function invalidateAll(queryClient: ReturnType<typeof useQueryClient>, keys: readonly (readonly string[])[]) {
  for (const queryKey of keys) {
    void queryClient.invalidateQueries({ queryKey: [...queryKey] });
  }
}

/** Üyelik, katalog, sipariş ve ayar değişikliklerini anında yansıtır. */
export function AppRealtimeBridge() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    try {
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
        .on("postgres_changes", { event: "*", schema: "public", table: "site_settings" }, () => {
          void queryClient.invalidateQueries({ queryKey: ["site-settings"] });
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
        .on("postgres_changes", { event: "*", schema: "public", table: "order_vendor_alerts" }, () => {
          invalidateAll(queryClient, ORDER_KEYS);
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "user_notifications" }, () => {
          void queryClient.invalidateQueries({ queryKey: ["notifications"] });
          void queryClient.invalidateQueries({ queryKey: ["notification-unread-count"] });
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "addresses" }, () => {
          void queryClient.invalidateQueries({ queryKey: ["addresses"] });
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
          invalidateAll(queryClient, MEMBERSHIP_KEYS);
        })
        .subscribe();

      return () => {
        void supabase.removeChannel(channel);
      };
    } catch (error) {
      console.error("[realtime]", error);
      return undefined;
    }
  }, [queryClient, user?.id]);

  return null;
}
