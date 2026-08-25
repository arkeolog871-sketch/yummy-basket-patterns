import { expect, test } from "@playwright/test";

test.describe("public catalog and legal pages", () => {
  test("home page renders without leaking stack traces", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.ok() || response?.status() === 200).toBeTruthy();
    await expect(page.locator("body")).not.toContainText("at Object.");
    await expect(page.locator("body")).not.toContainText("SUPABASE_SERVICE_ROLE_KEY");
    await expect(page.locator("body")).not.toContainText("sb_secret_");
  });

  test("restaurant list and auth routes are reachable", async ({ page }) => {
    await page.goto("/restoranlar");
    await expect(page.locator("body")).toBeVisible();
    await page.goto("/auth");
    await expect(page.getByRole("heading", { name: /Giriş yap|Hesap oluştur|İşletme girişi/ })).toBeVisible();
  });

  test("legal documents load", async ({ page }) => {
    for (const path of ["/kullanim-kosullari", "/gizlilik-politikasi", "/kvkk"]) {
      const response = await page.goto(path);
      expect(response?.status()).toBeLessThan(500);
      await expect(page.locator("h1")).toBeVisible();
    }
  });
});

test.describe("protected routes", () => {
  test("orders require login", async ({ page }) => {
    await page.goto("/siparislerim");
    await expect(page.getByRole("heading", { name: /Giriş yapmanız gerekiyor/ })).toBeVisible();
  });

  test("addresses require login", async ({ page }) => {
    await page.goto("/adreslerim");
    await expect(page.getByRole("heading", { name: /Giriş yapmanız gerekiyor/ })).toBeVisible();
  });

  test("checkout requires login", async ({ page }) => {
    await page.goto("/odeme");
    await expect(page.getByRole("heading", { name: /Giriş yapmanız gerekiyor/ })).toBeVisible();
  });

  test("vendor dashboard requires login", async ({ page }) => {
    await page.goto("/vendor/dashboard");
    await expect(page.getByRole("heading", { name: /Giriş yapmanız gerekiyor/ })).toBeVisible();
  });

  test("founder panel is not an open registration path", async ({ page }) => {
    await page.goto("/kurucu");
    await expect(page.locator("body")).not.toContainText("Kurucu ol");
    await expect(page.locator("body")).not.toContainText("SELF_CLAIM");
  });
});
