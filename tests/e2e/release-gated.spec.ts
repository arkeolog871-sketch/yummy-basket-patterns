/**
 * Staging-only mutating E2E. Never runs against uygulamamcebimde.online.
 * Missing mailbox/OAuth/vendor credentials => skip, never fake PASS.
 */
import { expect, test } from "@playwright/test";
import { isProductionTarget, stagingMailboxEnabled } from "./target";

const stagingUrl = process.env["STAGING_APP_URL"] || "";
const enabled = Boolean(stagingUrl) && !isProductionTarget(stagingUrl);
const otp = process.env["STAGING_OTP_CODE"] || "";
const vendorId = process.env["STAGING_VENDOR_IDENTIFIER"] || "";
const vendorOtp = process.env["STAGING_VENDOR_OTP_CODE"] || "";

test.describe("release-gated staging E2E", () => {
  test.skip(!enabled, "STAGING_APP_URL is not a non-production origin");
  test.use({ baseURL: stagingUrl });

  test("user: register/login OTP -> session -> authenticated route", async ({ page }) => {
    test.skip(
      !stagingMailboxEnabled() || !/^\d{6}$/.test(otp),
      "MANUAL ACTION REQUIRED: STAGING_TEST_EMAIL + mailbox + STAGING_OTP_CODE",
    );
    test.setTimeout(180_000);
    await page.goto("/auth");
    await page.getByTestId("auth-portal-customer").click({ force: true });
    await page.getByTestId("auth-method-code").click({ force: true });
    await page.locator("#user-otp-email").fill(process.env["STAGING_TEST_EMAIL"]!);
    await page.getByRole("button", { name: "Doğrulama kodu gönder" }).click();
    const code = page.getByLabel("6 haneli e-posta doğrulama kodu");
    await expect(code).toBeVisible({ timeout: 20_000 });
    const terms = page.getByRole("checkbox").first();
    if (await terms.isVisible().catch(() => false)) await terms.check({ force: true });
    await code.fill(otp);
    await page.getByRole("button", { name: "Doğrula" }).click();
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 30_000 });
    await page.goto("/siparislerim");
    await expect(page).not.toHaveURL(/\/auth/);
  });

  test("vendor: OTP -> dashboard scoped to assigned restaurant", async ({ page }) => {
    test.skip(
      !/^\d{6}$/.test(vendorOtp) || !vendorId,
      "MANUAL ACTION REQUIRED: STAGING_VENDOR_IDENTIFIER + STAGING_VENDOR_OTP_CODE",
    );
    test.setTimeout(180_000);
    await page.goto("/auth");
    await page.getByTestId("auth-portal-vendor").click({ force: true });
    await page.getByLabel(/telefon|e-posta/i).fill(vendorId);
    await page.getByRole("button", { name: /kod gönder|gönder/i }).click();
    const code = page.getByLabel("6 haneli e-posta doğrulama kodu");
    await expect(code).toBeVisible({ timeout: 20_000 });
    const terms = page.getByRole("checkbox").first();
    if (await terms.isVisible().catch(() => false)) await terms.check({ force: true });
    await code.fill(vendorOtp);
    await page.getByRole("button", { name: "Doğrula" }).click();
    await expect(page).toHaveURL(/\/vendor\/dashboard/, { timeout: 30_000 });
    await expect(page.locator("body")).not.toContainText("Forbidden");
  });

  test("order: create, stock decrement, duplicate idempotency", async () => {
    test.skip(
      true,
      "MANUAL ACTION REQUIRED: staging authenticated order fixture (no production writes)",
    );
  });

  test("google: OAuth callback establishes session", async () => {
    test.skip(
      true,
      "MANUAL ACTION REQUIRED: staging Google OAuth client + interactive account chooser",
    );
  });
});

test.describe("android App Link surface (local, no secrets)", () => {
  test("GET /auth is reachable for App Links pathPrefix", async ({ request }) => {
    test.skip(isProductionTarget(), "mutating/production target blocked");
    const response = await request.get("/auth");
    expect(response.status()).toBeLessThan(500);
    expect(response.headers()["content-type"] ?? "").toMatch(/html/);
  });

  test("GET /.well-known/assetlinks.json is JSON 200 with production package", async ({
    request,
  }) => {
    test.skip(isProductionTarget(), "do not treat live 404 as pass; probe production separately");
    const response = await request.get("/.well-known/assetlinks.json");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"] ?? "").toMatch(/json/i);
    const body = (await response.json()) as Array<{
      target?: { package_name?: string; sha256_cert_fingerprints?: string[] };
    }>;
    expect(body[0]?.target?.package_name).toBe("online.uygulamamcebimde.app");
    expect(body[0]?.target?.sha256_cert_fingerprints ?? []).toEqual([]);
  });
});
