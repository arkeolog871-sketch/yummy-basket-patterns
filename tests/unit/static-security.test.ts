import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git" || entry === "dist" || entry === ".output") continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

describe("static secret and authorization controls", () => {
  it("does not ship the service role key to browser modules", () => {
    const clientFiles = [
      "src/integrations/supabase/client.ts",
      "src/lib/public-env.ts",
      "src/hooks/useAuth.tsx",
      "src/hooks/useAccess.tsx",
    ];
    for (const file of clientFiles) {
      const text = readFileSync(join(ROOT, file), "utf8");
      expect(text).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
      expect(text).not.toMatch(/VITE_SUPABASE_SERVICE/);
    }
  });

  it("keeps service-role client behind .server modules", () => {
    const text = readFileSync(join(ROOT, "src/integrations/supabase/client.server.ts"), "utf8");
    expect(text).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(text).toMatch(/Only use this for trusted server-side operations/);
  });

  it("does not hard-code live secrets in source", () => {
    const files = walk(join(ROOT, "src")).concat([
      join(ROOT, ".env.example"),
      join(ROOT, "android-wrapper/app/build.gradle.kts"),
    ]);
    const secretLike = /sk_live_|sb_secret_[A-Za-z0-9]{20,}|eyJhbGciOi/;
    for (const file of files) {
      if (file.endsWith(".map")) continue;
      const text = readFileSync(file, "utf8");
      expect(text, relative(ROOT, file)).not.toMatch(secretLike);
    }
  });

  it("scopes vendor product updates to restaurant_id", () => {
    const text = readFileSync(join(ROOT, "src/lib/vendor-media.functions.ts"), "utf8");
    expect(text).toMatch(/assertVendor/);
    expect(text).toMatch(/\.eq\("restaurant_id", restaurantId\)/);
    expect(text).toMatch(/Bu ürün işletmenize ait değil/);
  });

  it("requires verified email before vendor APIs, orders, and addresses", () => {
    const vendor = readFileSync(join(ROOT, "src/lib/vendor.server.ts"), "utf8");
    const orders = readFileSync(join(ROOT, "src/lib/orders.functions.ts"), "utf8");
    const addresses = readFileSync(join(ROOT, "src/lib/addresses.functions.ts"), "utf8");
    const founder = readFileSync(join(ROOT, "src/lib/founder.server.ts"), "utf8");
    expect(vendor).toMatch(/assertVerifiedEmail/);
    expect(orders).toMatch(/assertVerifiedEmail/);
    expect(addresses).toMatch(/assertVerifiedEmail/);
    expect(founder).toMatch(/assertVerifiedEmail/);
    expect(orders).toMatch(/\.eq\("user_id", context\.userId\)/);
    expect(addresses).toMatch(/\.eq\("user_id", context\.userId\)/);
  });

  it("creates restaurants inactive until email verification", () => {
    const text = readFileSync(join(ROOT, "src/lib/founder.functions.ts"), "utf8");
    expect(text).toMatch(/is_active:\s*false/);
    expect(text).toMatch(/emailVerified/);
  });

  it("does not activate vendor storefront before first verify", () => {
    const text = readFileSync(join(ROOT, "src/lib/otp.server.ts"), "utf8");
    expect(text).toMatch(/activateVendorRestaurantOnFirstVerify/);
    expect(text).toMatch(/wasUnconfirmed/);
    expect(text).toMatch(/email_confirm: false/);
    expect(text).toMatch(/consumeIssuedOtp/);
    expect(text).toMatch(/invalidateUndeliveredCode/);
  });

  it("defines atomic OTP and order RPCs as service-role only", () => {
    const sql = readFileSync(join(ROOT, "supabase/migrations/20260825223000_otp_order_atomic_rpc.sql"), "utf8");
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public.issue_email_otp/);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public.consume_email_otp/);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public.place_customer_order/);
    expect(sql).toMatch(/FOR UPDATE/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public.issue_email_otp/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public.place_customer_order/);
    expect(sql).not.toMatch(/GRANT EXECUTE ON FUNCTION public.place_customer_order[\s\S]*TO authenticated/);
  });

  it("locks OTP issue/consume/failure with an advisory transaction lock and CAS consume", () => {
    const sql = readFileSync(join(ROOT, "supabase/migrations/20260825230000_otp_advisory_lock_cas.sql"), "utf8");
    expect(sql).toMatch(/pg_advisory_xact_lock/);
    expect(sql).toMatch(/GET DIAGNOSTICS v_updated = ROW_COUNT/);
    expect(sql).toMatch(/code_hash IS NOT DISTINCT FROM p_code_hash/);
  });
});
