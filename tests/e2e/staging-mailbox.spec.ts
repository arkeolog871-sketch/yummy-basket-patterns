/**
 * Staging OTP/order E2E. Skipped unless STAGING_APP_URL is a non-production HTTPS origin.
 * A real mailbox code may be supplied as STAGING_OTP_CODE after the operator reads the inbox.
 * This file never targets https://uygulamamcebimde.online.
 */
import { expect, test, type Page } from "@playwright/test";
import { isProductionTarget, stagingMailboxEnabled } from "./target";

const stagingUrl = process.env["STAGING_APP_URL"] || "";
const enabled = Boolean(stagingUrl) && !isProductionTarget(stagingUrl);

test.describe("staging OTP and order E2E", () => {
  test.skip(!enabled, "STAGING_APP_URL is not configured for a non-production origin");

  test.use({ baseURL: stagingUrl });

  test("OTP field rejects 5 digits, 7 digits, and letters before verify", async ({ page }) => {
    await openCustomerCodeLogin(page);
    await page.locator("#user-otp-email").fill(process.env["STAGING_TEST_EMAIL"] || "staging-otp@example.com");
    await page.getByRole("button", { name: "Doğrulama kodu gönder" }).click();
    const code = page.getByLabel("6 haneli e-posta doğrulama kodu");
    await expect(code).toBeVisible({ timeout: 20_000 });
    await expect(code).toHaveAttribute("maxlength", "6");
    await code.fill("12345");
    await expect(page.getByRole("button", { name: "Doğrula" })).toBeDisabled();
    await code.fill("1234567");
    await expect(code).toHaveValue(/^\d{0,6}$/);
    await code.fill("12ab56");
    await expect(code).not.toHaveValue("12ab56");
  });

  test("mailbox signup/login path runs only with operator-supplied OTP", async ({ page }) => {
    test.skip(!stagingMailboxEnabled() || !process.env["STAGING_OTP_CODE"], "Mailbox operator code not supplied");
    test.setTimeout(180_000);
    const email = process.env["STAGING_TEST_EMAIL"]!;
    const password = process.env["STAGING_TEST_PASSWORD"] || "";
    const otp = process.env["STAGING_OTP_CODE"]!;
    expect(otp).toMatch(/^\d{6}$/);

    await page.goto("/auth");
    await page.getByTestId("auth-portal-customer").click({ force: true });
    await page.locator("#email").fill(email);
    if (password) await page.locator("#password").fill(password);
    await openCustomerCodeLogin(page);
    await page.locator("#user-otp-email").fill(email);
    const code = page.getByLabel("6 haneli e-posta doğrulama kodu");
    await expect(code).toBeVisible({ timeout: 20_000 });
    await acceptTermsIfPresent(page);
    await code.fill(otp);
    await page.getByRole("button", { name: "Doğrula" }).click();
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 30_000 });
  });
});

async function openCustomerCodeLogin(page: Page) {
  await page.goto("/auth");
  await page.getByTestId("auth-portal-customer").click({ force: true });
  await expect(async () => {
    await page.getByTestId("auth-method-code").click({ force: true });
    await expect(page.getByRole("button", { name: "Doğrulama kodu gönder" })).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 15_000, intervals: [150, 300, 500] });
}

async function acceptTermsIfPresent(page: Page) {
  const terms = page.getByRole("checkbox").first();
  if (await terms.isVisible().catch(() => false)) {
    await terms.check({ force: true }).catch(() => undefined);
  }
}
