import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ANDROID_APP_PACKAGE_NAME, ANDROID_ASSETLINKS } from "@/lib/android-assetlinks";
import { PRODUCTION_OAUTH_ORIGIN } from "@/lib/google-oauth";
import { googleOAuthRedirectUriForOrigin } from "@/lib/google-oauth";

const ROOT = join(import.meta.dirname, "../..");

describe("production release contract (no secrets)", () => {
  it("documents required server env names without shipping values", () => {
    const example = readFileSync(join(ROOT, ".env.example"), "utf8");
    for (const name of [
      "SUPABASE_URL",
      "SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "LOVABLE_API_KEY",
      "VITE_GOOGLE_OAUTH_CLIENT_ID",
      "GOOGLE_OAUTH_CLIENT_SECRET",
      "GOOGLE_OAUTH_STATE_SECRET",
    ]) {
      expect(example).toContain(`${name}=`);
    }
    expect(example).not.toMatch(/eyJhbGciOi/);
    expect(example).not.toMatch(/sk_live_/);
  });

  it("keeps Android package and the Play App Signing SHA-256", () => {
    expect(ANDROID_APP_PACKAGE_NAME).toBe("online.uygulamamcebimde.app");
    expect(ANDROID_ASSETLINKS[0]?.target.sha256_cert_fingerprints).toEqual([
      "52:F0:37:72:53:80:CE:26:86:61:AF:3F:D3:70:FD:D9:27:67:D1:D6:FF:EC:8B:9D:14:85:03:92:FF:81:CE:A3",
    ]);
  });

  it("pins Google production redirect to apex /auth", () => {
    expect(PRODUCTION_OAUTH_ORIGIN).toBe("https://uygulamamcebimde.online");
    expect(googleOAuthRedirectUriForOrigin("https://uygulamamcebimde.online")).toBe(
      "https://uygulamamcebimde.online/auth",
    );
    expect(googleOAuthRedirectUriForOrigin("https://www.uygulamamcebimde.online")).toBe(
      "https://uygulamamcebimde.online/auth",
    );
  });

  it("ships the three production RPC migrations as files", () => {
    for (const file of [
      "supabase/migrations/20260825223000_otp_order_atomic_rpc.sql",
      "supabase/migrations/20260825230000_otp_advisory_lock_cas.sql",
      "supabase/migrations/20260826120000_request_rate_limit.sql",
    ]) {
      expect(existsSync(join(ROOT, file)), file).toBe(true);
    }
    const order = readFileSync(
      join(ROOT, "supabase/migrations/20260825223000_otp_order_atomic_rpc.sql"),
      "utf8",
    );
    expect(order).toMatch(/place_customer_order/);
    expect(order).toMatch(/issue_email_otp/);
    expect(order).toMatch(/consume_email_otp/);
    const rate = readFileSync(
      join(ROOT, "supabase/migrations/20260826120000_request_rate_limit.sql"),
      "utf8",
    );
    expect(rate).toMatch(/consume_request_rate_limit/);
    expect(
      existsSync(join(ROOT, "supabase/migrations/20260826183000_place_order_idempotency_payment.sql")),
    ).toBe(true);
    const place = readFileSync(
      join(ROOT, "supabase/migrations/20260826183000_place_order_idempotency_payment.sql"),
      "utf8",
    );
    const placeSql = place
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
    expect(placeSql).toMatch(/ADD COLUMN IF NOT EXISTS idempotency_key/);
    expect(placeSql).toMatch(/ADD COLUMN IF NOT EXISTS payment_method/);
    expect(placeSql).toMatch(/ADD COLUMN IF NOT EXISTS opens_at/);
    expect(placeSql).toMatch(/cash_on_delivery/);
    expect(placeSql).toMatch(/orders_user_idempotency_key_uidx/);
    expect(placeSql).toMatch(/auth\.uid\(\)/);
    expect(placeSql).toMatch(/is_open_manual/);
    expect(placeSql).toMatch(/v_menu\.price/);
    expect(placeSql).toMatch(/v_restaurant\.delivery_fee/);
    expect(placeSql).toMatch(/FOR UPDATE/);
    expect(placeSql).toMatch(/GRANT EXECUTE[\s\S]*TO service_role/);
    expect(placeSql).toMatch(/REVOKE ALL[\s\S]*FROM PUBLIC, anon, authenticated/);
    expect(placeSql).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(placeSql).not.toMatch(/DISABLE ROW LEVEL SECURITY/);
    expect(placeSql).not.toMatch(/GRANT INSERT ON public\.orders TO (anon|PUBLIC)/);
    expect(placeSql).not.toMatch(/DROP POLICY/);
    const verify = readFileSync(join(ROOT, "docs/go-live/PRODUCTION_ORDER_SQL_VERIFY.sql"), "utf8");
    const verifySql = verify
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
    expect(verifySql).toMatch(/idempotency_key/);
    expect(verifySql).toMatch(/payment_method/);
    expect(verifySql).toMatch(/place_customer_order/);
    expect(verifySql).not.toMatch(/\b(INSERT INTO|UPDATE |DELETE FROM|ALTER TABLE|DROP TABLE|DROP POLICY|GRANT |REVOKE )\b/i);
  });
});
