import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * ÖLÇÜLDÜ (canlı, 23 Eylül 2026): cancel_customer_order anonim çağrıya açıktı.
 * Sahiplik denetimi oturum yokken atlanıyordu ve PUBLIC EXECUTE yetkisi
 * kalmıştı. Düzeltme canlıya uygulandı; anonim çağrı artık 42501 alıyor.
 */
describe("sipariş iptali oturum ister", () => {
  const sql = readFileSync(
    "supabase/migrations/20260923170000_cancel_order_require_session.sql",
    "utf8",
  );

  it("oturumsuz çağrı reddedilir", () => {
    expect(sql).toContain("IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id THEN");
    expect(sql).not.toContain("auth.uid() IS NOT NULL AND");
  });

  it("PUBLIC ve anon yetkisi kaldırılır, yalnız oturumlu kullanıcı ve sunucu çağırır", () => {
    expect(sql).toContain(
      "REVOKE ALL ON FUNCTION public.cancel_customer_order(uuid, uuid) FROM PUBLIC, anon;",
    );
    expect(sql).toContain(
      "GRANT EXECUTE ON FUNCTION public.cancel_customer_order(uuid, uuid) TO authenticated, service_role;",
    );
  });

  it("tek çağıran kullanıcı oturumuyla çağırır", () => {
    const orders = readFileSync("src/lib/orders.functions.ts", "utf8");
    expect(orders).toContain('context.supabase.rpc("cancel_customer_order"');
    expect(orders).not.toMatch(/supabaseAdmin\.rpc\("cancel_customer_order"/);
  });
});
