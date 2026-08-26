import { webkit, devices } from "@playwright/test";

const ORIGIN = "https://uygulamamcebimde.online";
const PASSWORD = "IosOtp-26a!xyz";

const result = {
  send: "BAŞARISIZ",
  otpReceived: false,
  verifyClicked: false,
  home: false,
  session: false,
  logoutRelogin: false,
  notes: [],
};

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
          subject: String(full.subject || ""),
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

async function openCustomerAuth(page) {
  await page.goto(`${ORIGIN}/auth`, { waitUntil: "domcontentloaded" });
  const customer = page.getByRole("button", { name: "Müşteri girişi" });
  await customer.waitFor({ timeout: 20_000 });
  await customer.click();
}

async function openSignup(page) {
  const heading = page.locator("h1").first();
  await page
    .getByRole("button", { name: /Hesabınız yok mu\? Kayıt olun|Zaten hesabınız var mı\? Giriş yapın/ })
    .waitFor({ timeout: 20_000 });
  for (let i = 0; i < 8; i++) {
    const text = (await heading.innerText()).trim();
    if (text === "Hesap oluştur") return;
    await page.getByRole("button", { name: "Hesabınız yok mu? Kayıt olun" }).click().catch(() => {});
    await page.waitForTimeout(300);
  }
  throw new Error("Kayıt ekranı açılmadı");
}

/**
 * Live production: checkbox sits in <label for="…-terms">.
 * Clicking the input on WebKit toggles twice. Space on focus toggles once.
 */
async function acceptTerms(page) {
  const terms = page.locator('input[name="termsAccepted"]');
  await terms.waitFor({ state: "visible", timeout: 20_000 });
  if (await terms.isChecked()) return;
  await terms.focus();
  await page.keyboard.press("Space");
  await page.waitForTimeout(250);
  if (await terms.isChecked()) return;
  await page.getByText(/'ni okudum, kabul ediyorum/).click();
  await page.waitForTimeout(250);
  if (!(await terms.isChecked())) {
    throw new Error("KVKK onayı WebKit'te işaretlenemedi");
  }
}

/**
 * 5 hane + KVKK sonrası Doğrula hâlâ disabled. 6. hane yazılır yazılmaz
 * düğme etkinleşir; tıklama o ana hizalanır ki onComplete yarışını kaybetmeyelim.
 */
async function enterOtpAndClickVerify(page, code) {
  const digits = String(code);
  await acceptTerms(page);
  const otp = page.getByLabel("6 haneli e-posta doğrulama kodu");
  await otp.waitFor({ state: "visible", timeout: 15_000 });
  await otp.click();
  await otp.fill("");
  await otp.pressSequentially(digits.slice(0, 5), { delay: 50 });

  const verify = page.getByRole("button", { name: /^Doğrula$/ });
  await verify.waitFor({ state: "visible", timeout: 8_000 });
  const clickPromise = verify.click({ timeout: 12_000 });
  await otp.pressSequentially(digits.slice(5), { delay: 20 });
  try {
    await clickPromise;
    return true;
  } catch (error) {
    if (!page.url().includes("/auth")) return false;
    throw new Error(
      `Doğrula tıklanamadı: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function assertHomeAndSession(page, timeout = 30_000) {
  await page.waitForURL(
    (url) => {
      try {
        return new URL(url).pathname === "/";
      } catch {
        return false;
      }
    },
    { timeout },
  );
  await page.getByRole("button", { name: "Hesabım" }).waitFor({ timeout: 15_000 });
  await page
    .getByRole("button", { name: /^Doğrula$/ })
    .waitFor({ state: "hidden", timeout: 8_000 })
    .catch(() => {});
  const keys = authStorageKeys(await dumpStorage(page));
  if (!keys.length) throw new Error("Ana sayfada oturum anahtarı yok");
  result.home = true;
  result.session = true;
  return keys.length;
}

async function logout(page) {
  await page.getByRole("button", { name: "Hesabım" }).click();
  await page.getByRole("menuitem", { name: "Çıkış yap" }).click();
  await page.getByRole("link", { name: "Giriş yap" }).first().waitFor({ timeout: 20_000 });
}

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

  await openCustomerAuth(page);
  const publicEnv = await page.evaluate(() => window.__PUBLIC_ENV__ || {});
  result.notes.push(
    `supabase_host=${new URL(publicEnv.VITE_SUPABASE_URL || "https://invalid.local").host}`,
  );
  if (!String(publicEnv.VITE_SUPABASE_URL || "").includes("wxkyhwkcuiqxxxpawcid")) {
    throw new Error("iOS webview farklı Supabase host kullanıyor");
  }

  await openSignup(page);
  await page.locator("#fullName").fill("iOS OTP Test");
  await page.locator("#phone").fill("05551234567");
  await page.locator("#email").fill(box.address);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Kayıt ol" }).click();
  await page.getByText(/e-posta doğrulanmadı|6 haneli kodu girerek/i).waitFor({ timeout: 30_000 });
  result.send = "BAŞARILI";

  const mail = await waitForOtp(box.token);
  result.otpReceived = /^\d{6}$/.test(mail.code);
  result.notes.push(`mail_from_notify=${mail.from.includes("notify.uygulamamcebimde.online")}`);
  result.notes.push(`mail_subject_ok=${/doğrulayın|giriş kodunuz/i.test(mail.subject)}`);
  result.notes.push(`otp_len=${mail.code.length}`);
  if (!result.otpReceived) throw new Error("OTP 6 haneli değil");

  result.verifyClicked = await enterOtpAndClickVerify(page, mail.code);
  result.notes.push(`verify_clicked=${result.verifyClicked}`);
  const sessionKeys = await assertHomeAndSession(page);
  result.notes.push(`session_keys=${sessionKeys}`);

  await page.reload({ waitUntil: "domcontentloaded" });
  await assertHomeAndSession(page, 20_000);

  await logout(page);

  await openCustomerAuth(page);
  await page.getByRole("button", { name: "E-posta kodu ile" }).click();
  await page.locator("#user-otp-email").fill(box.address);
  await page.getByRole("button", { name: "Doğrulama kodu gönder" }).click();
  await page.getByLabel("6 haneli e-posta doğrulama kodu").waitFor({ timeout: 20_000 });
  const loginMail = await waitForOtp(box.token, 90_000, new Set([mail.code]));
  result.notes.push(`relogin_otp_len=${loginMail.code.length}`);

  const reloginClicked = await enterOtpAndClickVerify(page, loginMail.code);
  result.notes.push(`relogin_verify_clicked=${reloginClicked}`);
  result.verifyClicked = result.verifyClicked && reloginClicked;
  const reloginKeys = await assertHomeAndSession(page);
  result.notes.push(`relogin_keys=${reloginKeys}`);
  result.logoutRelogin = true;

  await page
    .screenshot({
      path: "/opt/cursor/artifacts/ios_webkit_otp_home.png",
      fullPage: true,
    })
    .catch(() => {});
} catch (error) {
  result.notes.push(`error=${error instanceof Error ? error.message : String(error)}`);
  result.notes.push(`url=${page.url()}`);
  const body = await page.locator("body").innerText().catch(() => "");
  result.notes.push(`body=${body.slice(0, 400).replace(/\s+/g, " ")}`);
} finally {
  await browser.close();
}

console.log(JSON.stringify(result, null, 2));

const passed =
  result.send === "BAŞARILI" &&
  result.otpReceived &&
  result.verifyClicked &&
  result.home &&
  result.session &&
  result.logoutRelogin;
if (!passed) process.exit(1);
