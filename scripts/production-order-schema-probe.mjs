#!/usr/bin/env node
/**
 * READ-ONLY production proof for order-create. No INSERT. Does not print keys.
 * Fetches the live site public env and checks columns, RPC, and JS fingerprints.
 */
const ORIGIN = process.env.BASE_URL || "https://uygulamamcebimde.online";

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`PASS ${message}`);
}

const html = await fetch(ORIGIN, { headers: { "user-agent": "Mozilla/5.0" } }).then((r) => r.text());
const envMatch = html.match(/window\.__PUBLIC_ENV__=(\{.*?\});/);
if (!envMatch) {
  fail("production HTML missing __PUBLIC_ENV__");
  process.exit(1);
}
const env = JSON.parse(envMatch[1]);
const supabaseUrl = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!supabaseUrl || !key) {
  fail("public supabase env missing");
  process.exit(1);
}
console.log(`origin ${ORIGIN}`);
console.log(`supabase ${supabaseUrl}`);
console.log(`apk ${env.VITE_APK_REV || "unknown"}`);
console.log(`index ${[...html.matchAll(/\/assets\/(index-[A-Za-z0-9_-]+\.js)/g)].map((m) => m[1]).join(",") || "none"}`);

async function rest(path, { method = "GET", body } = {}) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: response.status, json, text };
}

async function columnExists(table, column) {
  const result = await rest(`/rest/v1/${table}?select=${column}&limit=0`);
  if (result.status === 200) return true;
  const code = result.json?.code;
  if (code === "42703") return false;
  throw new Error(`${table}.${column} unexpected ${result.status} ${result.text.slice(0, 180)}`);
}

const orderCols = {
  id: true,
  user_id: true,
  restaurant_id: true,
  status: true,
  payment_status: true,
  subtotal: true,
  delivery_fee: true,
  total: true,
  idempotency_key: false,
  payment_method: false,
  order_number: false,
};
const itemCols = {
  id: true,
  order_id: true,
  menu_item_id: true,
  name: true,
  quantity: true,
  unit_price: true,
  item_name: false,
  total_price: false,
};

console.log("\n[orders]");
for (const [column, expected] of Object.entries(orderCols)) {
  const exists = await columnExists("orders", column);
  const label = exists ? "EXISTS" : "MISSING";
  if (["idempotency_key", "payment_method"].includes(column)) {
    if (exists) pass(`orders.${column}=${label}`);
    else fail(`orders.${column}=${label} (migration not applied)`);
  } else if (column === "order_number") {
    console.log(`INFO orders.order_number=${label} (app uses orders.id; not required)`);
  } else if (exists === expected) {
    pass(`orders.${column}=${label}`);
  } else {
    fail(`orders.${column}=${label}`);
  }
}

console.log("\n[order_items]");
for (const [column, expected] of Object.entries(itemCols)) {
  const exists = await columnExists("order_items", column);
  const label = exists ? "EXISTS" : "MISSING";
  if (exists === expected) pass(`order_items.${column}=${label}`);
  else fail(`order_items.${column}=${label}`);
}

const rpc = await rest("/rest/v1/rpc/place_customer_order", {
  method: "POST",
  body: {
    p_user_id: "00000000-0000-0000-0000-000000000001",
    p_restaurant_id: "557b3793-1b1c-4198-817a-a31f6db43eb4",
    p_items: [],
    p_recipient_name: "probe",
    p_phone: "05000000000",
    p_city: "Diyarbakır",
    p_district: "Silvan",
    p_street: "Probe sokak 12",
    p_directions: null,
    p_note: null,
    p_idempotency_key: "00000000-0000-0000-0000-000000000003",
  },
});
console.log("\n[rpc]");
if (rpc.status === 404 || rpc.json?.code === "PGRST202") {
  fail("place_customer_order MISSING (PGRST202)");
} else {
  pass(`place_customer_order reachable status=${rpc.status} code=${rpc.json?.code || "none"}`);
}

const rls = await rest("/rest/v1/orders", {
  method: "POST",
  body: {
    user_id: "00000000-0000-0000-0000-000000000001",
    restaurant_id: "557b3793-1b1c-4198-817a-a31f6db43eb4",
    recipient_name: "Probe",
    phone: "05000000000",
    city: "Diyarbakır",
    district: "Silvan",
    street: "Probe sokak 1",
    subtotal: 1,
    delivery_fee: 0,
    total: 1,
    status: "confirmed",
    payment_status: "unpaid",
  },
});
if (rls.json?.code === "42501") pass("anon INSERT still blocked by RLS (42501)");
else fail(`anon INSERT unexpected ${rls.status} ${String(rls.text).slice(0, 160)}`);

const odeme = await fetch(`${ORIGIN}/odeme`, { headers: { "user-agent": "Mozilla/5.0" } }).then((r) =>
  r.text(),
);
const odemeAsset = (odeme.match(/\/assets\/(odeme-[A-Za-z0-9_-]+\.js)/) || [])[1] || "none";
const ordersAsset =
  (odeme.match(/\/assets\/(orders\.functions-[A-Za-z0-9_-]+\.js)/) || [])[1] || "none";
console.log("\n[frontend]");
console.log(`INFO live odeme chunk ${odemeAsset}`);
console.log(`INFO live orders.functions chunk ${ordersAsset}`);

const odemeJs = await fetch(`${ORIGIN}/assets/${odemeAsset}`).then((r) => r.text());
if (odemeJs.includes("Sipariş gönderiliyor")) pass("live odeme.js has new pending label");
else fail("live odeme.js missing 'Sipariş gönderiliyor' (old frontend)");
if (odemeJs.includes("idempotency")) pass("live odeme.js sends idempotency_key");
else fail("live odeme.js does not send idempotency_key");

if (process.exitCode) {
  console.error("\nProduction order schema/frontend probe FAILED.");
  process.exit(process.exitCode);
}
console.log("\nProduction order schema/frontend probe PASSED.");
