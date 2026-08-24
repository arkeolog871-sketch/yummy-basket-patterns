#!/usr/bin/env node
/** Tam uygulama simülasyonu: rotalar, varlıklar, güvenlik, önbellek sınırı, 10k yük. */

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:4173";

const PUBLIC_PAGES = [
  ["home", "/", 200, ["SİLVAN", "CEBİMDE"]],
  ["home sector", "/?kategori=yemek", 200, ["SİLVAN"]],
  ["home search", "/?q=ocak", 200, ["SİLVAN"]],
  ["restaurants", "/restoranlar", 200, ["SİLVAN"]],
  ["restaurant", "/restoran/ocakbasi-dukkani", 200, ["Ocakbaşı"]],
  ["cart", "/sepet", 200, ["Sepet"]],
  ["auth", "/auth", 200, ["Giriş"]],
  ["founder login", "/kurucu-giris", 200, ["Kurucu"]],
  ["iphone", "/iphone", 200, []],
  ["android", "/android", 200, []],
  ["download", "/indir", 200, []],
  ["mobile", "/mobil", 200, []],
  ["reset", "/sifre-sifirlama", 200, []],
];

const AUTH_WALLS = [
  ["pay", "/odeme", ["Giriş", "giriş", "Yükleniyor"]],
  ["addresses", "/adreslerim", ["Giriş", "giriş", "Yükleniyor"]],
  ["orders", "/siparislerim", ["Giriş", "giriş", "Yükleniyor"]],
];

const SECURITY = [
  ["unknown", "/olmayan-sayfa-xyz", [404]],
  ["env", "/.env", [404]],
  ["git", "/.git/config", [403, 404]],
  ["php", "/wp-admin", [404]],
  ["media traversal", "/api/public/media/product-images/../secret.png", [404]],
  ["brand traversal", "/api/public/brand/../secret", [404]],
];

const REQUIRED_HEADERS = [
  "content-security-policy",
  "strict-transport-security",
  "x-content-type-options",
  "x-frame-options",
  "referrer-policy",
  "permissions-policy",
];

let failures = 0;
const results = [];

function fail(name, detail) {
  failures += 1;
  results.push({ name, ok: false, detail });
  console.error(`FAIL ${name}: ${detail}`);
}

function pass(name, detail) {
  results.push({ name, ok: true, detail });
  console.log(`PASS ${name}${detail ? `: ${detail}` : ""}`);
}

async function fetchPath(path, headers = {}) {
  const response = await fetch(new URL(path, baseUrl), { headers });
  const buffer = Buffer.from(await response.arrayBuffer());
  return { response, buffer, text: buffer.toString("utf8") };
}

for (const [name, path, status, needles] of PUBLIC_PAGES) {
  const { response, text } = await fetchPath(path);
  if (response.status !== status) fail(name, `status ${response.status}`);
  else if (needles.some((needle) => !text.includes(needle))) fail(name, `missing ${needles.join("|")}`);
  else pass(name, String(response.status));
}

for (const [name, path, needles] of AUTH_WALLS) {
  const { response, text } = await fetchPath(path);
  if (response.status !== 200) fail(name, `status ${response.status}`);
  else if (!needles.some((needle) => text.includes(needle))) fail(name, "auth wall missing");
  else pass(name, "auth wall");
}

for (const [name, path, accepted] of SECURITY) {
  const { response } = await fetchPath(path);
  if (!accepted.includes(response.status)) fail(name, `status ${response.status}`);
  else pass(name, String(response.status));
}

const home = await fetchPath("/");
for (const header of REQUIRED_HEADERS) {
  if (!home.response.headers.get(header)) fail(`header ${header}`, "missing");
  else pass(`header ${header}`);
}
const csp = home.response.headers.get("content-security-policy") ?? "";
if (!csp.includes("wss://*.supabase.co")) fail("csp realtime", "wss://*.supabase.co missing");
else pass("csp realtime");

const allowOrigin = (
  await fetchPath("/", { Origin: "https://evil.example" })
).response.headers.get("access-control-allow-origin");
if (allowOrigin === "*" || allowOrigin === "https://evil.example") fail("cors", String(allowOrigin));
else pass("cors");

const assetHrefs = [...home.text.matchAll(/(?:href|src)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
const uniqueAssets = [...new Set(assetHrefs)].slice(0, 12);
if (uniqueAssets.length === 0) fail("assets", "homepage has no /assets");
for (const asset of uniqueAssets) {
  const { response, buffer } = await fetchPath(asset);
  if (response.status !== 200 || buffer.length < 20) fail(`asset ${asset}`, `status ${response.status}`);
  else pass(`asset ${asset}`, String(buffer.length));
}

const authed = await fetchPath("/", { cookie: "sb-projectref-auth-token=fake.jwt" });
if (authed.response.status !== 200) fail("authed home", String(authed.response.status));
else pass("authed home");

const privatePage = await fetchPath("/odeme");
if (privatePage.text.includes("Ocakbaşı") && privatePage.text.includes("İzgaralar")) {
  fail("cache isolation", "payment page looks like restaurant html");
} else pass("cache isolation");

const users = Number(process.env.USERS || 10_000);
const paths = [
  "/",
  "/?kategori=yemek",
  "/restoran/ocakbasi-dukkani",
  "/sepet",
  "/auth",
  uniqueAssets[0] || "/favicon.png",
].filter(Boolean);

async function loadOne(path) {
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(new URL(path, baseUrl), { signal: controller.signal });
    await response.arrayBuffer();
    return { ok: response.ok, status: response.status, ms: performance.now() - started, error: null };
  } catch (error) {
    const code = error?.name === "AbortError" ? "TIMEOUT" : error?.cause?.code || error?.name || "ERROR";
    return { ok: false, status: 0, ms: performance.now() - started, error: String(code) };
  } finally {
    clearTimeout(timer);
  }
}

const jobs = Array.from({ length: users }, (_, i) => paths[i % paths.length]);
const t0 = performance.now();
const load = await Promise.all(jobs.map(loadOne));
const elapsed = performance.now() - t0;
const ok = load.filter((row) => row.ok).length;
const latencies = load.map((row) => row.ms).sort((a, b) => a - b);
const p = (pct) => latencies[Math.min(latencies.length - 1, Math.ceil((pct / 100) * latencies.length) - 1)] || 0;
const statuses = {};
const errors = {};
for (const row of load) {
  statuses[String(row.status)] = (statuses[String(row.status)] || 0) + 1;
  if (row.error) errors[row.error] = (errors[row.error] || 0) + 1;
}

const loadSummary = {
  users,
  elapsedMs: Math.round(elapsed),
  success: ok,
  failed: users - ok,
  successRate: `${((ok / users) * 100).toFixed(2)}%`,
  statuses,
  errors,
  latencyMs: { p50: Math.round(p(50)), p95: Math.round(p(95)), p99: Math.round(p(99)), max: Math.round(latencies.at(-1) || 0) },
};
console.log(JSON.stringify({ load: loadSummary }, null, 2));
if (ok / users < 0.99) fail("10k load", `${ok}/${users}`);
else pass("10k load", `${ok}/${users} in ${loadSummary.elapsedMs}ms`);

if (failures > 0) {
  console.error(`${failures} simulation check(s) failed.`);
  process.exitCode = 1;
} else {
  console.log("Full simulation passed.");
}
