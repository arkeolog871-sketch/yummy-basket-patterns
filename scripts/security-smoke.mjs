const baseUrl = process.env.BASE_URL ?? "http://localhost:5173";

const checks = [
  ["home", "/", 200],
  ["unknown route", "/security-smoke-404", 404],
  ["env probe", "/.env", 404],
  ["git probe", "/.git/config", 404],
  ["php probe", "/wp-admin", 404],
  ["media traversal", "/api/public/media/product-images/../secret.png", 404],
  ["media invalid path", "/api/public/media/product-images/not-a-uuid/file.png", 404],
  ["brand traversal", "/api/public/brand/../secret", 404],
];

let failures = 0;

for (const [name, path, expectedStatus] of checks) {
  const response = await fetch(new URL(path, baseUrl));
  if (response.status !== expectedStatus) {
    failures += 1;
    console.error(`FAIL ${name}: expected ${expectedStatus}, received ${response.status}`);
  } else {
    console.log(`PASS ${name}: ${response.status}`);
  }
}

const home = await fetch(new URL("/", baseUrl));
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

const corsProbe = await fetch(new URL("/", baseUrl), {
  headers: { Origin: "https://evil.example" },
});
const allowOrigin = corsProbe.headers.get("access-control-allow-origin");
if (allowOrigin === "*" || allowOrigin === "https://evil.example") {
  failures += 1;
  console.error(`FAIL permissive CORS: ${allowOrigin}`);
} else {
  console.log("PASS permissive CORS is not enabled");
}

if (failures > 0) {
  process.exitCode = 1;
  console.error(`${failures} security smoke check(s) failed.`);
} else {
  console.log("All security smoke checks passed.");
}
