#!/usr/bin/env node
/**
 * Apply ONLY the order-create migration to the production Supabase project.
 * Refuses to run unless both of these are set:
 *   ALLOW_PRODUCTION_ORDER_MIGRATION=YES
 *   PRODUCTION_DATABASE_URL=postgresql://...wxkyhwkcuiqxxxpawcid...
 *
 * Never disables RLS. Never inserts orders. Never prints the connection URL.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PRODUCTION_PROJECT_REF, looksLikeProduction } from "./lib/env-safety.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = join(ROOT, "supabase/migrations/20260826183000_place_order_idempotency_payment.sql");
const url = process.env.PRODUCTION_DATABASE_URL || "";
const allowed = process.env.ALLOW_PRODUCTION_ORDER_MIGRATION === "YES";

if (!allowed) {
  console.error("BLOCKED: set ALLOW_PRODUCTION_ORDER_MIGRATION=YES to apply this file to production.");
  process.exit(3);
}
if (!url) {
  console.error("BLOCKED: PRODUCTION_DATABASE_URL is not set.");
  process.exit(3);
}
if (!looksLikeProduction(url) || !url.toLowerCase().includes(PRODUCTION_PROJECT_REF)) {
  console.error("BLOCKED: PRODUCTION_DATABASE_URL is not the production project ref.");
  process.exit(2);
}

function psql(args) {
  const result = spawnSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-t", "-A", ...args], {
    encoding: "utf8",
    env: { ...process.env },
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "psql failed").trim().slice(0, 800));
  }
  return (result.stdout || "").trim();
}

function scalar(sql) {
  return psql(["-c", sql]);
}

console.log("Preflight: production order schema (no data rewrite).");
const db = scalar("SELECT current_database();");
const rlsOrders = scalar("SELECT relrowsecurity FROM pg_class WHERE relname = 'orders' AND relnamespace = 'public'::regnamespace;");
const rlsItems = scalar("SELECT relrowsecurity FROM pg_class WHERE relname = 'order_items' AND relnamespace = 'public'::regnamespace;");
if (rlsOrders !== "t" || rlsItems !== "t") {
  console.error(`BLOCKED: expected RLS enabled on orders/order_items, got orders=${rlsOrders} items=${rlsItems}`);
  process.exit(2);
}
console.log(`database=${db} rls_orders=${rlsOrders} rls_items=${rlsItems}`);

const beforeKey = scalar("SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='idempotency_key';");
const beforePay = scalar("SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='payment_method';");
const beforeRpc = scalar("SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='place_customer_order';");
console.log(`before idempotency_key=${beforeKey} payment_method=${beforePay} rpc=${beforeRpc}`);

console.log("Applying 20260826183000_place_order_idempotency_payment.sql");
psql(["-f", FILE]);

const afterKey = scalar("SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='idempotency_key';");
const afterPay = scalar("SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='payment_method';");
const afterRpc = scalar("SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='place_customer_order';");
const afterRls = scalar("SELECT relrowsecurity FROM pg_class WHERE relname = 'orders' AND relnamespace = 'public'::regnamespace;");
const anonExec = scalar(`
  SELECT has_function_privilege('anon', 'public.place_customer_order(uuid,uuid,jsonb,text,text,text,text,text,text,text,text)', 'EXECUTE');
`);
const authExec = scalar(`
  SELECT has_function_privilege('authenticated', 'public.place_customer_order(uuid,uuid,jsonb,text,text,text,text,text,text,text,text)', 'EXECUTE');
`);
const serviceExec = scalar(`
  SELECT has_function_privilege('service_role', 'public.place_customer_order(uuid,uuid,jsonb,text,text,text,text,text,text,text,text)', 'EXECUTE');
`);
const anonInsert = scalar("SELECT has_table_privilege('anon', 'public.orders', 'INSERT');");

if (afterKey !== "1" || afterPay !== "1" || afterRpc !== "1") {
  console.error(`FAIL schema after apply key=${afterKey} pay=${afterPay} rpc=${afterRpc}`);
  process.exit(1);
}
if (afterRls !== "t") {
  console.error("FAIL RLS was not left enabled on orders");
  process.exit(1);
}
if (anonExec === "t" || authExec === "t") {
  console.error(`FAIL execute leaked anon=${anonExec} authenticated=${authExec}`);
  process.exit(1);
}
if (serviceExec !== "t") {
  console.error("FAIL service_role cannot execute place_customer_order");
  process.exit(1);
}
if (anonInsert === "t") {
  console.error("FAIL anon gained INSERT on orders");
  process.exit(1);
}

console.log("after idempotency_key=EXISTS payment_method=EXISTS place_customer_order=EXISTS");
console.log(`execute anon=${anonExec} authenticated=${authExec} service_role=${serviceExec}`);
console.log(`anon_orders_insert=${anonInsert} rls_orders=${afterRls}`);
console.log("Production order migration applied. No order rows were inserted.");
