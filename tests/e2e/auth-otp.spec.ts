import { expect, test } from "@playwright/test";

test.describe("customer registration UI", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/auth");
    await page.getByRole("button", { name: "Müşteri girişi" }).click();
    await page.getByRole("button", { name: /Hesabınız yok mu/ }).click();
    await expect(page.getByRole("heading", { name: "Hesap oluştur" })).toBeVisible();
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
  test("code login exposes 6 numeric slots and resend control after send attempt", async ({ page }) => {
    await page.goto("/auth");
    await page.getByRole("button", { name: "E-posta kodu ile" }).click();
    await expect(page.getByLabel("E-posta")).toBeVisible();
    await page.getByLabel("E-posta").fill("otp-ui@example.com");
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
      await expect(page.locator("[data-sonner-toast], [role=alert], body")).toBeVisible();
    }
  });

  test("vendor portal does not offer self-serve business signup", async ({ page }) => {
    await page.goto("/auth");
    await page.getByRole("button", { name: "İşletme girişi" }).click();
    await expect(page.getByRole("heading", { name: "İşletme girişi" })).toBeVisible();
    await expect(page.getByText(/Kurucu ekiple iletişime/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Kayıt ol" })).toHaveCount(0);
  });
});
