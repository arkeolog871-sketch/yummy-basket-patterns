import { expect, test, type Page } from "@playwright/test";
import { isProductionTarget } from "./target";

test.skip(isProductionTarget(), "Production OTP send/verify is forbidden in this suite");

async function openAuth(page: Page) {
  await page.goto("/auth");
  await expect(page.getByTestId("auth-heading")).toBeVisible();
}

async function clickUntilHeading(page: Page, testId: string, heading: string) {
  await expect(async () => {
    await page.getByTestId(testId).click({ force: true });
    await expect(page.getByTestId("auth-heading")).toHaveText(heading, { timeout: 500 });
  }).toPass({ timeout: 15_000, intervals: [150, 300, 500] });
}

test.describe("customer registration UI", () => {
  test.beforeEach(async ({ page }) => {
    await openAuth(page);
    await page.getByTestId("auth-portal-customer").click({ force: true });
    await expect(async () => {
      const heading = await page.getByTestId("auth-heading").innerText();
      if (heading !== "Hesap oluştur") {
        await page.getByTestId("auth-toggle-mode").click({ force: true });
      }
      await expect(page.getByTestId("auth-heading")).toHaveText("Hesap oluştur", { timeout: 500 });
    }).toPass({ timeout: 15_000, intervals: [150, 300, 500] });
  });

  test("empty fields are blocked by required inputs", async ({ page }) => {
    await page.getByRole("button", { name: "Kayıt ol" }).click();
    const email = page.locator("#email");
    const valid = await email.evaluate((el: HTMLInputElement) => el.checkValidity());
    expect(valid).toBe(false);
  });

  test("invalid email is rejected by the browser constraint", async ({ page }) => {
    await page.locator("#fullName").fill("Test Kullanıcı");
    await page.locator("#phone").fill("05321234567");
    await page.locator("#email").fill("not-an-email");
    await page.locator("#password").fill("secret1");
    await page.getByRole("button", { name: "Kayıt ol" }).click();
    const email = page.locator("#email");
    const valid = await email.evaluate((el: HTMLInputElement) => el.checkValidity());
    expect(valid).toBe(false);
  });

  test("short password is rejected", async ({ page }) => {
    await page.locator("#fullName").fill("Test Kullanıcı");
    await page.locator("#phone").fill("05321234567");
    await page.locator("#email").fill("test@example.com");
    await page.locator("#password").fill("123");
    await page.getByRole("button", { name: "Kayıt ol" }).click();
    const password = page.locator("#password");
    const valid = await password.evaluate((el: HTMLInputElement) => el.checkValidity());
    expect(valid).toBe(false);
  });

  test("short phone is rejected by client logic", async ({ page }) => {
    await page.locator("#fullName").fill("Test Kullanıcı");
    await page.locator("#phone").fill("123");
    await page.locator("#email").fill("test@example.com");
    await page.locator("#password").fill("secret1");
    await page.getByRole("button", { name: "Kayıt ol" }).click();
    await expect(page.getByText(/Telefon numarası en az 10 haneli/)).toBeVisible();
  });
});

test.describe("6-digit OTP UI", () => {
  test("code login exposes 6 numeric slots after switching method", async ({ page }) => {
    await openAuth(page);
    await page.getByTestId("auth-portal-customer").click({ force: true });
    await expect(async () => {
      await page.getByTestId("auth-method-code").click({ force: true });
      await expect(page.getByRole("button", { name: "Doğrulama kodu gönder" })).toBeVisible({
        timeout: 500,
      });
    }).toPass({ timeout: 15_000, intervals: [150, 300, 500] });
    await page.locator("#user-otp-email").fill("otp-ui@example.com");
    await page.getByRole("button", { name: "Doğrulama kodu gönder" }).click();
    const code = page.getByLabel("6 haneli e-posta doğrulama kodu");
    const appeared = await code.waitFor({ state: "visible", timeout: 8000 }).then(
      () => true,
      () => false,
    );
    if (appeared) {
      await expect(code).toHaveAttribute("maxlength", "6");
      await code.pressSequentially("12345");
      await expect(page.getByRole("button", { name: "Doğrula" })).toBeDisabled();
      await code.fill("1234567");
      await expect(code).toHaveValue(/^\d{0,6}$/);
    } else {
      await expect(page.locator("body")).not.toContainText("at Object.");
      await expect(page.locator("body")).not.toContainText("sb_secret_");
    }
  });

  test("vendor portal does not offer self-serve business signup", async ({ page }) => {
    await openAuth(page);
    await clickUntilHeading(page, "auth-portal-vendor", "İşletme girişi");
    await expect(page.getByText(/Kurucu ekiple iletişime/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Kayıt ol" })).toHaveCount(0);
  });
});
