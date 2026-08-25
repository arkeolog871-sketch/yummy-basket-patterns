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

  it("requires verified email before vendor APIs and orders", () => {
    const vendor = readFileSync(join(ROOT, "src/lib/vendor.server.ts"), "utf8");
    const orders = readFileSync(join(ROOT, "src/lib/orders.functions.ts"), "utf8");
    const founder = readFileSync(join(ROOT, "src/lib/founder.server.ts"), "utf8");
    expect(vendor).toMatch(/assertVerifiedEmail/);
    expect(orders).toMatch(/assertVerifiedEmail/);
    expect(founder).toMatch(/assertVerifiedEmail/);
    expect(orders).toMatch(/\.eq\("user_id", context\.userId\)/);
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
  });
});
