import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const failures = [];

function read(rel) {
  const path = resolve(root, rel);
  if (!existsSync(path)) {
    failures.push(`missing file: ${rel}`);
    return "";
  }
  return readFileSync(path, "utf8");
}

function mustContain(rel, needles, label = rel) {
  const text = read(rel);
  if (!text) return;
  for (const needle of needles) {
    if (!text.includes(needle)) failures.push(`${label}: missing ${JSON.stringify(needle)}`);
  }
}

function mustNotContain(rel, needles) {
  const text = read(rel);
  if (!text) return;
  for (const needle of needles) {
    if (text.includes(needle)) failures.push(`${rel}: unexpected ${JSON.stringify(needle)}`);
  }
}

mustContain("src/lib/otp.ts", ["export const OTP_CODE_LENGTH = 6"]);
mustContain("src/components/auth/OtpCodeInput.tsx", [
  "OTP_CODE_LENGTH",
  "one-time-code",
  "inputMode",
  "text-[16px]",
  "isIosDevice",
  "[0-9]*",
]);
mustContain("src/components/legal/LegalConsentCheckbox.tsx", [
  "type=\"checkbox\"",
  "okudum, kabul ediyorum",
]);
mustContain("src/components/business/CallButton.tsx", ["openTelHref", "tel:${telefonNumarasi}"]);
mustContain("src/lib/ios.ts", ["openTelHref", "installTelSchemeGuard", "tel:"]);
mustContain("src/lib/phone.ts", ["toTelHref", "toTelNumber"]);
mustContain("src/routes/__root.tsx", [
  'name: "format-detection"',
  'content: "telephone=yes"',
  "apple-mobile-web-app-capable",
  "installTelSchemeGuard",
]);
mustContain("src/routes/restoran.$slug.tsx", ["CallButton"]);
mustContain("public/manifest.webmanifest", ['"display": "standalone"']);
mustContain("public/_headers", [
  "/silvan-cebimde-iphone.mobileconfig",
  "application/x-apple-aspen-config",
]);

const config = read("public/silvan-cebimde-iphone.mobileconfig");
if (config) {
  for (const needle of [
    "<key>FullScreen</key>",
    "<true/>",
    "<key>URL</key>",
    "https://uygulamamcebimde.online/",
    "com.apple.webClip.managed",
    "SİLVAN CEBİMDE",
  ]) {
    if (!config.includes(needle)) failures.push(`mobileconfig: missing ${JSON.stringify(needle)}`);
  }
}

for (const asset of ["public/apple-touch-icon.png", "public/app-icon-192.png", "public/app-icon-512.png"]) {
  if (!existsSync(resolve(root, asset))) failures.push(`missing asset: ${asset}`);
}

mustNotContain("package.json", ["@capacitor/", "react-native", "expo"]);
mustNotContain("public/_headers", ["Permissions-Policy: tel="]);

if (existsSync(resolve(root, "ios")) || existsSync(resolve(root, "Info.plist"))) {
  failures.push("unexpected native iOS project (this app ships as Safari PWA / Web Clip)");
}

if (failures.length > 0) {
  console.error("iOS PWA prepare failed:");
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log("iOS PWA checks passed.");
console.log("Platform: Safari Add to Home Screen + Web Clip (silvan-cebimde-iphone.mobileconfig).");
console.log("No Xcode/Capacitor target — vite build produces the iOS-ready web app.");
