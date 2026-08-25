#!/usr/bin/env node
/**
 * Production READ-ONLY smoke. GET only. Never signs up, verifies OTP, places
 * orders, or brute-forces. Does not print secrets.
 */
import { looksLikeProduction } from "./lib/env-safety.mjs";

const baseUrl = process.env.BASE_URL || "https://uygulamamcebimde.online";
if (!looksLikeProduction(baseUrl) && process.env.ALLOW_NONPROD_PROBE !== "1") {
  console.error("This probe defaults to production. Set BASE_URL to the production origin.");
  process.exit(2);
}

const checks = [
  ["home", "/", 200],
  ["unknown route", "/security-smoke-404", 404],
  ["env probe", "/.env", [403, 404]],
  ["git probe", "/.git/config", [403, 404]],
  ["php probe", "/wp-admin", 404],
  ["media traversal", "/api/public/media/product-images/../secret.png", [400, 403, 404]],
  ["auth page GET", "/auth", [200, 304]],
  ["orders gate GET", "/siparislerim", [200, 302, 304]],
];

let failures = 0;
const notes = [];

async function get(path, headers = {}) {
  return fetch(new URL(path, baseUrl), { method: "GET", redirect: "manual", headers });
}

for (const [name, path, expected] of checks) {
  const response = await get(path);
  const accepted = Array.isArray(expected) ? expected : [expected];
  if (!accepted.includes(response.status)) {
    failures += 1;
    console.error(`FAIL ${name}: expected ${accepted.join(" or ")}, received ${response.status}`);
  } else {
    console.log(`PASS ${name}: ${response.status}`);
  }
}

const home = await get("/");
const requiredHeaders = [
  "content-security-policy",
  "strict-transport-security",
  "x-content-type-options",
  "x-frame-options",
  "referrer-policy",
  "permissions-policy",
];
for (const header of requiredHeaders) {
  if (!home.headers.get(header)) {
    failures += 1;
    console.error(`FAIL security header missing: ${header}`);
  } else {
    console.log(`PASS security header: ${header}`);
  }
}

const corsProbe = await get("/", { Origin: "https://evil.example" });
const allowOrigin = corsProbe.headers.get("access-control-allow-origin");
if (allowOrigin === "*" || allowOrigin === "https://evil.example") {
  failures += 1;
  console.error(`FAIL permissive CORS: ${allowOrigin}`);
} else {
  console.log("PASS permissive CORS is not enabled");
}

const cfRay = home.headers.get("cf-ray");
const cfCache = home.headers.get("cf-cache-status");
const server = home.headers.get("server");
if (cfRay || (server && /cloudflare/i.test(server))) {
  console.log("PASS Cloudflare proxy headers are present");
  notes.push("cloudflare_proxy=yes");
} else {
  console.log("WARNING Cloudflare proxy headers were not observed on GET /");
  notes.push("cloudflare_proxy=unknown");
}
if (cfCache) notes.push(`cf-cache-status=${cfCache}`);

let rpcPresence = "unknown";
try {
  const html = await home.text();
  const supabaseUrl = html.match(/https:\/\/[a-z0-9]+\.supabase\.co/)?.[0] || "";
  const publishable = html.match(/sb_publishable_[A-Za-z0-9_]+/)?.[0] || "";
  if (supabaseUrl && publishable) {
    const openapi = await fetch(new URL("/rest/v1/", supabaseUrl), {
      method: "GET",
      headers: {
        apikey: publishable,
        Accept: "application/openapi+json",
      },
    });
    if (openapi.ok) {
      const spec = await openapi.text();
      const names = ["issue_email_otp", "consume_email_otp", "register_email_otp_failure", "place_customer_order"];
      const present = names.filter((name) => spec.includes(name));
      rpcPresence = present.length === names.length ? "present" : `partial:${present.length}/${names.length}`;
      // OpenAPI may omit service-role-only RPCs; treat absence as unknown rather than missing.
      if (present.length === 0) rpcPresence = "not_in_anon_openapi";
    } else {
      rpcPresence = `openapi_http_${openapi.status}`;
    }
  } else {
    rpcPresence = "no_public_supabase_url_in_html";
  }
} catch {
  rpcPresence = "probe_error";
}
console.log(`INFO production RPC OpenAPI visibility: ${rpcPresence} (service-role RPCs may be hidden from anon)`);
notes.push(`rpc_openapi=${rpcPresence}`);

if (failures > 0) {
  process.exitCode = 1;
  console.error(`${failures} production read-only check(s) failed.`);
} else {
  console.log("All production read-only checks passed.");
}
console.log(`NOTES ${notes.join("; ")}`);
