import { webkit, devices } from "@playwright/test";

const ORIGIN = "https://uygulamamcebimde.online";
const PASSWORD = "IosOtp-26a!xyz";

async function mailTmAccount() {
  const domains = await fetch("https://api.mail.tm/domains").then((r) => r.json());
  const domain = domains["hydra:member"][0].domain;
  const address = `iosotp${Date.now()}@${domain}`;
  const password = "IosMail-26a!";
  const created = await fetch("https://api.mail.tm/accounts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address, password }),
  });
  if (!created.ok) throw new Error(`mailbox create ${created.status}`);
  const tokenRes = await fetch("https://api.mail.tm/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address, password }),
  });
  const { token } = await tokenRes.json();
  return { address, token };
}

async function waitForOtp(token, timeoutMs = 90_000, usedCodes = new Set()) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const list = await fetch("https://api.mail.tm/messages", {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json());
    const messages = list["hydra:member"] || [];
    for (const preview of messages) {
      const full = await fetch(`https://api.mail.tm/messages/${preview.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json());
      const text = String(full.text || "");
      const match = text.match(/(?<!\d)(\d{6})(?!\d)/);
      if (match && !usedCodes.has(match[1])) {
        return {
          code: match[1],
          subject: full.subject,
          from: full.from?.address || "",
        };
      }
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
  throw new Error("OTP e-postası gelmedi");
}

function authStorageKeys(localStorageDump) {
  return Object.keys(localStorageDump).filter(
    (k) => k.startsWith("sb-") && k.includes("auth-token"),
  );
}

async function dumpStorage(page) {
  return page.evaluate(() => {
    const out = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) out[k] = localStorage.getItem(k) ? "present" : "empty";
    }
    return out;
  });
}

async function waitLoggedIn(page, timeout = 30_000) {
  await page.getByRole("button", { name: "Hesabım" }).waitFor({ timeout });
  await page.waitForURL((url) => {
    try {
      const path = new URL(url).pathname;
      return path === "/" || (path !== "/auth" && !path.startsWith("/auth"));
    } catch {
      return false;
    }
  }, { timeout: 20_000 });
  await page.getByRole("button", { name: /^Doğrula$/ }).waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {});
}

async function clickSignup(page) {
  const heading = page.locator("h1").first();
  const toggle = page.getByRole("button", { name: /Hesabınız yok mu\? Kayıt olun|Zaten hesabınız var mı\? Giriş yapın/ });
  await toggle.waitFor({ timeout: 20_000 });
  for (let i = 0; i < 8; i++) {
    const text = (await heading.innerText()).trim();
    if (text === "Hesap oluştur") return;
    await page.getByRole("button", { name: /Hesabınız yok mu\? Kayıt olun/ }).click({ force: true }).catch(() => {});
    await page.waitForTimeout(350);
  }
  throw new Error("Kayıt ekranı açılmadı");
}

async function acceptTerms(page) {
  const terms = page.locator('input[name="termsAccepted"]');
  await terms.waitFor({ state: "visible", timeout: 20_000 });
  if (await terms.isChecked()) return;
  await page.evaluate(() => {
    const input = document.querySelector('input[name="termsAccepted"]');
    if (!(input instanceof HTMLInputElement)) return;
    const label = input.closest("label");
    if (label?.hasAttribute("for")) label.removeAttribute("for");
    input.disabled = false;
    input.click();
  });
  await page.waitForTimeout(300);
  if (await terms.isChecked()) return;
  await page.getByText(/okudum, kabul ediyorum/).click({ force: true }).catch(() => {});
  await page.waitForTimeout(300);
}

async function fillOtp(page, code) {
  await acceptTerms(page);
  const otp = page.getByLabel("6 haneli e-posta doğrulama kodu");
  await otp.waitFor({ state: "visible", timeout: 10_000 });
  await otp.fill("");
  await otp.fill(code);
  try {
    await waitLoggedIn(page, 8_000);
    return;
  } catch {
    /* auto-verify may still be in flight or Doğrula is required */
  }
  if (!page.url().includes("/auth")) return;
  const verify = page.getByRole("button", { name: /^Doğrula$/ });
  if ((await verify.count()) === 0) return;
  const visible = await verify.isVisible().catch(() => false);
  const enabled = visible && (await verify.isEnabled().catch(() => false));
  if (enabled) {
    await verify.click({ force: true });
  }
}

const result = {
  send: "BAŞARISIZ",
  verify: "BAŞARISIZ",
  persist: "BAŞARISIZ",
  relogin: "BAŞARISIZ",
  notes: [],
};

const browser = await webkit.launch({ headless: true });
const iphone = devices["iPhone 14"];
const context = await browser.newContext({
  ...iphone,
  locale: "tr-TR",
  timezoneId: "Europe/Istanbul",
});
const page = await context.newPage();
page.setDefaultTimeout(25_000);

try {
  const box = await mailTmAccount();
  result.notes.push(`mailbox_domain=${box.address.split("@")[1]}`);
  result.notes.push(`ua=${iphone.userAgent.includes("iPhone") ? "iPhone" : "other"}`);

  await page.goto(`${ORIGIN}/auth`, { waitUntil: "domcontentloaded" });
  const publicEnv = await page.evaluate(() => window.__PUBLIC_ENV__ || {});
  result.notes.push(`supabase_host=${new URL(publicEnv.VITE_SUPABASE_URL || "https://invalid.local").host}`);
  if (!String(publicEnv.VITE_SUPABASE_URL || "").includes("wxkyhwkcuiqxxxpawcid")) {
    throw new Error("iOS webview farklı Supabase host kullanıyor");
  }

  const customerTab = page.getByRole("button", { name: "Müşteri girişi" });
  await customerTab.waitFor({ timeout: 20_000 });
  await customerTab.click({ force: true });
  await clickSignup(page);
  await page.locator("#fullName").fill("iOS OTP Test");
  await page.locator("#phone").fill("05551234567");
  await page.locator("#email").fill(box.address);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Kayıt ol" }).click();

  const otpHeading = page.getByText(/e-posta doğrulanmadı|6 haneli kodu girerek/i);
  await otpHeading.waitFor({ timeout: 30_000 });
  result.send = "API_OK_WAIT_MAIL";

  const mail = await waitForOtp(box.token);
  result.notes.push(`mail_from_notify=${mail.from.includes("notify.uygulamamcebimde.online")}`);
  result.notes.push(`mail_subject_ok=${/doğrulayın|giriş kodunuz/i.test(mail.subject)}`);
  result.send = "BAŞARILI";

  await fillOtp(page, mail.code);
  await waitLoggedIn(page);
  const afterVerify = await dumpStorage(page);
  const keys = authStorageKeys(afterVerify);
  result.notes.push(`session_keys=${keys.length}`);
  if (!keys.length) throw new Error("setSession sonrası localStorage boş");
  result.verify = "BAŞARILI";

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitLoggedIn(page, 20_000);
  const afterReload = await dumpStorage(page);
  result.notes.push(`persist_keys=${authStorageKeys(afterReload).length}`);
  result.persist = "BAŞARILI";

  await page.getByRole("button", { name: "Hesabım" }).click();
  await page.getByRole("menuitem", { name: "Çıkış yap" }).click();
  await page.getByRole("link", { name: "Giriş yap" }).first().waitFor({ timeout: 20_000 });

  await page.goto(`${ORIGIN}/auth`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Müşteri girişi" }).click({ force: true });
  await page.getByRole("button", { name: "E-posta kodu ile" }).click({ force: true });
  await page.locator("#user-otp-email").fill(box.address);
  await page.getByRole("button", { name: "Doğrulama kodu gönder" }).click();
  await page.getByLabel("6 haneli e-posta doğrulama kodu").waitFor({ timeout: 20_000 });
  const loginMail = await waitForOtp(box.token, 90_000, new Set([mail.code]));
  await fillOtp(page, loginMail.code);
  await waitLoggedIn(page);
  const afterRelogin = await dumpStorage(page);
  result.notes.push(`relogin_keys=${authStorageKeys(afterRelogin).length}`);
  if (!authStorageKeys(afterRelogin).length) throw new Error("yeniden girişte oturum yok");
  result.relogin = "BAŞARILI";
  await page.screenshot({
    path: "/opt/cursor/artifacts/ios_otp_home_after_relogin.png",
    fullPage: true,
  }).catch(() => {});
} catch (error) {
  result.notes.push(`error=${error instanceof Error ? error.message : String(error)}`);
  const url = page.url();
  result.notes.push(`url=${url}`);
  const body = await page.locator("body").innerText().catch(() => "");
  result.notes.push(`body=${body.slice(0, 400).replace(/\s+/g, " ")}`);
} finally {
  await browser.close();
}

console.log(JSON.stringify(result, null, 2));
if (result.send !== "BAŞARILI" || result.verify !== "BAŞARILI" || result.persist !== "BAŞARILI" || result.relogin !== "BAŞARILI") {
  process.exit(1);
}
