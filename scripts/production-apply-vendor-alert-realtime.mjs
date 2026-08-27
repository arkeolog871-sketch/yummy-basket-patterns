#!/usr/bin/env node
/**
 * Apply the vendor-alert realtime trigger migration to production Supabase.
 * Refuses unless:
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
const FILE = join(ROOT, "supabase/migrations/20260827020000_order_vendor_alerts_realtime_trigger.sql");
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

console.log("Preflight: vendor alert realtime (no data rewrite).");
const rlsOrders = scalar(
  "SELECT relrowsecurity FROM pg_class WHERE relname = 'orders' AND relnamespace = 'public'::regnamespace;",
);
const tableExists = scalar(
  "SELECT count(*) FROM pg_class WHERE relname = 'order_vendor_alerts' AND relnamespace = 'public'::regnamespace;",
);
if (rlsOrders !== "t") {
  console.error(`BLOCKED: expected RLS enabled on orders, got ${rlsOrders}`);
  process.exit(2);
}
console.log(`rls_orders=${rlsOrders} order_vendor_alerts=${tableExists}`);

psql(["-f", FILE]);

const trigger = scalar(
  "SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relname='orders' AND t.tgname='order_vendor_alerts_on_order_insert';",
);
const published = scalar(
  "SELECT count(*) FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='order_vendor_alerts';",
);
const authSelect = scalar("SELECT has_table_privilege('authenticated', 'public.order_vendor_alerts', 'SELECT');");
const anonSelect = scalar("SELECT has_table_privilege('anon', 'public.order_vendor_alerts', 'SELECT');");
const rlsAlerts = scalar(
  "SELECT relrowsecurity FROM pg_class WHERE relname = 'order_vendor_alerts' AND relnamespace = 'public'::regnamespace;",
);

console.log(
  `trigger=${trigger} published=${published} auth_select=${authSelect} anon_select=${anonSelect} rls_alerts=${rlsAlerts}`,
);

if (trigger !== "1" || published !== "1" || authSelect !== "t" || anonSelect !== "f" || rlsAlerts !== "t") {
  console.error("FAIL vendor alert realtime migration postconditions.");
  process.exit(1);
}
console.log("Applied 20260827020000_order_vendor_alerts_realtime_trigger.sql");
