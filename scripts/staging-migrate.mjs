#!/usr/bin/env node
/**
 * Apply OTP/order RPC migrations to STAGING only.
 * Never targets the production project ref or production hostname.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assertNotProduction, looksLikeProduction, stagingConfigured } from "./lib/env-safety.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const url = process.env.STAGING_DATABASE_URL || process.env.STAGING_SUPABASE_DB_URL || "";

if (!stagingConfigured() || !url) {
  console.error("BLOCKED: staging credentials are not configured in this environment.");
  console.error(
    "Set STAGING_DATABASE_URL (or STAGING_SUPABASE_DB_URL) for a non-production database.",
  );
  console.error("Production migrations were not touched.");
  process.exit(3);
}

assertNotProduction("STAGING_DATABASE_URL", url);

const psql = spawnSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-c", "SELECT current_database();"], {
  encoding: "utf8",
  env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD },
});
if (psql.status !== 0) {
  console.error("BLOCKED: could not connect to staging database.");
  console.error((psql.stderr || psql.stdout || "").trim() || "psql failed");
  process.exit(3);
}

const identity = spawnSync(
  "psql",
  [url, "-t", "-A", "-c", "SELECT current_database() || ' @ ' || inet_server_addr()::text;"],
  { encoding: "utf8" },
);
const identityText = (identity.stdout || "").trim();
if (looksLikeProduction(identityText)) {
  console.error("BLOCKED: connected database identity looks like production.");
  process.exit(2);
}

const files = [
  join(ROOT, "supabase/migrations/20260825223000_otp_order_atomic_rpc.sql"),
  join(ROOT, "supabase/migrations/20260825230000_otp_advisory_lock_cas.sql"),
  join(ROOT, "supabase/migrations/20260826120000_request_rate_limit.sql"),
];

for (const file of files) {
  console.log(`Applying ${file.split("/").pop()} to staging...`);
  const applied = spawnSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-f", file], {
    encoding: "utf8",
  });
  if (applied.status !== 0) {
    console.error("BLOCKED: staging migration failed.");
    console.error((applied.stderr || applied.stdout || "").trim());
    process.exit(1);
  }
}

const verify = spawnSync(
  "psql",
  [
    url,
    "-t",
    "-A",
    "-c",
    `SELECT
       (SELECT count(*) FROM pg_proc WHERE proname IN ('issue_email_otp','consume_email_otp','register_email_otp_failure','place_customer_order')) AS rpc_count,
       (SELECT pg_get_functiondef('public.consume_email_otp(text,text,timestamptz)'::regprocedure) LIKE '%pg_advisory_xact_lock%') AS consume_locked,
       (SELECT EXISTS (
          SELECT 1 FROM pg_indexes WHERE indexname = 'orders_user_idempotency_key_uidx'
       )) AS idempotency_index,
       (SELECT EXISTS (
          SELECT 1 FROM pg_proc WHERE proname = 'consume_request_rate_limit'
       )) AS rate_rpc;`,
  ],
  { encoding: "utf8" },
);
if (verify.status !== 0) {
  console.error("BLOCKED: staging schema verification failed.");
  console.error((verify.stderr || verify.stdout || "").trim());
  process.exit(1);
}
const [rpcCount, consumeLocked, idempotencyIndex, rateRpc] = (verify.stdout || "")
  .trim()
  .split("|");
if (rpcCount !== "4" || consumeLocked !== "t" || idempotencyIndex !== "t" || rateRpc !== "t") {
  console.error(
    `BLOCKED: staging verification mismatch rpc=${rpcCount} locked=${consumeLocked} idx=${idempotencyIndex} rate=${rateRpc}`,
  );
  process.exit(1);
}
console.log(
  "STAGING schema/RPC verification passed (4 order/OTP RPCs, CAS consume lock, idempotency index, rate-limit RPC).",
);
console.log(
  "Existing staging rows were not rewritten; functions are CREATE OR REPLACE / ADD COLUMN IF NOT EXISTS.",
);
