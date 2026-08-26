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

  it("keeps Android package and empty SHA-256 placeholder", () => {
    expect(ANDROID_APP_PACKAGE_NAME).toBe("online.uygulamamcebimde.app");
    expect(ANDROID_ASSETLINKS[0]?.target.sha256_cert_fingerprints).toEqual([]);
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
  });
});
