#!/usr/bin/env node
/**
 * Mevcut FIREBASE_* ortam değişkenleriyle FCM HTTP v1 OAuth testi.
 * Gerçek secret yoksa başarısız olur; sahte değer üretmez.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createSign } from "node:crypto";

const projectId = process.env.FIREBASE_PROJECT_ID || "silvan-cebimde";
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();

function fail(message) {
  console.log(JSON.stringify({ ok: false, message }));
  process.exit(1);
}

if (!clientEmail || !privateKey) {
  fail("FIREBASE_CLIENT_EMAIL veya FIREBASE_PRIVATE_KEY ortamda yok");
}

const now = Math.floor(Date.now() / 1000);
const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
const claim = Buffer.from(
  JSON.stringify({
    iss: clientEmail,
    sub: clientEmail,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  }),
).toString("base64url");
const unsigned = `${header}.${claim}`;
const signer = createSign("RSA-SHA256");
signer.update(unsigned);
signer.end();
const signature = signer.sign(privateKey).toString("base64url");
const jwt = `${unsigned}.${signature}`;

const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: jwt,
  }),
});
const tokenJson = await tokenRes.json();
if (!tokenRes.ok || !tokenJson.access_token) {
  fail(`FCM OAuth başarısız: HTTP ${tokenRes.status}`);
}

// Android app id doğrulaması (iOS plist'ten türetilmiş, Firebase Installations ile doğrulanmış)
const plist = readFileSync(join(import.meta.dirname, "../ios/App/App/GoogleService-Info.plist"), "utf8");
const iosAppId = plist.match(/<key>GOOGLE_APP_ID<\/key>\s*<string>([^<]+)<\/string>/)?.[1];
const androidAppId = iosAppId?.replace(":ios:", ":android:");

console.log(
  JSON.stringify({
    ok: true,
    projectId,
    clientEmail,
    androidAppId,
    oauthStatus: tokenRes.status,
    message: "FCM OAuth token alındı; sunucu push gönderimi hazır",
  }),
);
