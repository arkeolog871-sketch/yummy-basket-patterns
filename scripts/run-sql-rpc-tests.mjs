#!/usr/bin/env node
/**
 * Applies OTP/order RPC migrations to an isolated local Postgres database
 * and verifies consume CAS, cooldown, lockout, oversell, idempotency, and rollback.
 * Refuses remote/staging/production URLs.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { looksLikeProduction } from "./lib/env-safety.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DB = process.env.SQL_RPC_TEST_DB || "silvan_rpc_test";

if (
  process.env.SQL_RPC_TEST_DATABASE_URL ||
  process.env.STAGING_DATABASE_URL ||
  process.env.DATABASE_URL
) {
  if (
    looksLikeProduction(
      process.env.SQL_RPC_TEST_DATABASE_URL ||
        process.env.STAGING_DATABASE_URL ||
        process.env.DATABASE_URL,
    )
  ) {
    console.error("Refusing to run SQL RPC tests against a production-looking URL.");
    process.exit(2);
  }
}
if (process.env.SQL_RPC_TEST_DATABASE_URL) {
  console.error(
    "This harness only uses the local Unix-socket Postgres cluster. Unset SQL_RPC_TEST_DATABASE_URL.",
  );
  process.exit(2);
}

function psql(args, options = {}) {
  const result = spawnSync(
    "sudo",
    ["-u", "postgres", "psql", "-d", DB, "-v", "ON_ERROR_STOP=1", ...args],
    {
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
      ...options,
    },
  );
  if (result.status !== 0) {
    const err = result.stderr || result.stdout || `psql exited ${result.status}`;
    throw new Error(err.trim());
  }
  return (result.stdout || "").trim();
}

function scalar(sql) {
  const raw = psql(["-t", "-A", "-q", "-c", sql]);
  const lines = raw
    .split("\n")
    .map((value) => value.trim())
    .filter((value) => value && !/^(INSERT|UPDATE|DELETE|SELECT) \d/.test(value));
  return lines[0] ?? "";
}

function file(path) {
  psql(["-f", path]);
}

let failed = 0;
function check(name, ok, detail = "") {
  if (ok) {
    console.log(`PASS ${name}`);
  } else {
    failed += 1;
    console.error(`FAIL ${name}${detail ? `: ${detail}` : ""}`);
  }
}

console.log(`Using local database ${DB} (not staging, not production)`);

psql([
  "-c",
  "DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS auth CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;",
]);
file(join(ROOT, "tests/sql/local-rpc-fixture.sql"));
file(join(ROOT, "supabase/migrations/20260825223000_otp_order_atomic_rpc.sql"));
file(join(ROOT, "supabase/migrations/20260825230000_otp_advisory_lock_cas.sql"));
file(join(ROOT, "supabase/migrations/20260826120000_request_rate_limit.sql"));

const consumeSrc = psql([
  "-t",
  "-A",
  "-q",
  "-c",
  "SELECT pg_get_functiondef('public.consume_email_otp(text,text,timestamptz)'::regprocedure);",
]);
check("consume uses advisory lock", consumeSrc.includes("pg_advisory_xact_lock"));
check("consume uses CAS UPDATE", /code_hash IS NOT DISTINCT FROM p_code_hash/.test(consumeSrc));

const emailHash = "a".repeat(64);
const codeHash = "b".repeat(64);
const otherHash = "c".repeat(64);
const t0 = "2026-08-25T12:00:00Z";
const t30 = "2026-08-25T12:00:30Z";
const t61 = "2026-08-25T12:01:01Z";
const tExpire = "2026-08-25T12:11:01Z";

const issue1 = scalar(
  `SELECT issue_email_otp('${emailHash}', '${codeHash}', '${t0}'::timestamptz)::text;`,
);
check("issue first OTP", issue1.includes('"ok": true'), issue1);

const issueCooldown = scalar(
  `SELECT issue_email_otp('${emailHash}', '${otherHash}', '${t30}'::timestamptz)::text;`,
);
check("60s resend cooldown cannot be bypassed", issueCooldown.includes("cooldown"), issueCooldown);

const issueLater = scalar(
  `SELECT issue_email_otp('${emailHash}', '${codeHash}', '${t61}'::timestamptz)::text;`,
);
check("issue allowed after cooldown", issueLater.includes('"ok": true'), issueLater);

const mismatch = scalar(
  `SELECT consume_email_otp('${emailHash}', '${otherHash}', '${t61}'::timestamptz);`,
);
check("wrong hash is mismatch", mismatch === "mismatch", mismatch);

const match = scalar(
  `SELECT consume_email_otp('${emailHash}', '${codeHash}', '${t61}'::timestamptz);`,
);
check("correct hash matches once", match === "match", match);

const replay = scalar(
  `SELECT consume_email_otp('${emailHash}', '${codeHash}', '${t61}'::timestamptz);`,
);
check("replay after consume is missing", replay === "missing", replay);

const expiredHash = "d".repeat(64);
scalar(
  `SELECT issue_email_otp('${"e".repeat(64)}', '${expiredHash}', '${t0}'::timestamptz)::text;`,
);
const expired = scalar(
  `SELECT consume_email_otp('${"e".repeat(64)}', '${expiredHash}', '${tExpire}'::timestamptz);`,
);
check("expired code is rejected", expired === "expired", expired);

const lockEmail = "f".repeat(64);
const lockCode = "1".repeat(64);
scalar(`SELECT issue_email_otp('${lockEmail}', '${lockCode}', '${t0}'::timestamptz)::text;`);
for (let i = 0; i < 5; i += 1) {
  scalar(
    `SELECT register_email_otp_failure('${lockEmail}', '${t0}'::timestamptz + interval '${i} seconds');`,
  );
}
const lockedAttempts = scalar(
  `SELECT failed_attempts FROM email_otp_guard WHERE email_hash = '${lockEmail}';`,
);
const lockedHash = scalar(
  `SELECT coalesce(code_hash, '') FROM email_otp_guard WHERE email_hash = '${lockEmail}';`,
);
const lockedConsume = scalar(
  `SELECT consume_email_otp('${lockEmail}', '${lockCode}', '${t0}'::timestamptz + interval '10 seconds');`,
);
check(
  "five failures lock and clear hash",
  lockedAttempts === "5" && lockedHash === "" && lockedConsume === "missing",
  `${lockedAttempts}/${lockedHash}/${lockedConsume}`,
);

const userA = "11111111-1111-1111-1111-111111111111";
const userB = "22222222-2222-2222-2222-222222222222";
scalar(`INSERT INTO auth.users (id) VALUES ('${userA}'), ('${userB}');`);
const restaurantId = scalar(
  `INSERT INTO restaurants (slug, name, delivery_fee, min_order, is_active) VALUES ('rpc-test', 'RPC Test', 10, 20, true) RETURNING id;`,
);
const itemId = scalar(
  `INSERT INTO menu_items (restaurant_id, name, price, is_available, stock_quantity) VALUES ('${restaurantId}', 'Lahmacun', 50, true, 2) RETURNING id;`,
);

function place(userId, qty, key, extra = "") {
  return scalar(`
    SELECT place_customer_order(
      '${userId}'::uuid,
      '${restaurantId}'::uuid,
      '[{"menu_item_id":"${itemId}","quantity":${qty}}]'::jsonb,
      'Test User',
      '05321234567',
      'Diyarbakır',
      'Silvan',
      'Test sokak 1',
      NULL,
      ${extra ? `'${extra}'` : "NULL"},
      ${key ? `'${key}'` : "NULL"}
    )::text;
  `);
}

const oversell = place(userA, 9, null);
const stockAfterOversell = scalar(`SELECT stock_quantity FROM menu_items WHERE id = '${itemId}';`);
check("oversell is rejected", oversell.includes("yeterli stok yok"), oversell);
check("oversell does not decrement stock", stockAfterOversell === "2", stockAfterOversell);

const idemKey = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const firstOrder = place(userA, 1, idemKey);
const secondOrder = place(userA, 1, idemKey);
const orderCount = scalar(
  `SELECT count(*) FROM orders WHERE user_id = '${userA}' AND idempotency_key = '${idemKey}';`,
);
const stockAfterIdem = scalar(`SELECT stock_quantity FROM menu_items WHERE id = '${itemId}';`);
const firstId = JSON.parse(firstOrder).id;
const secondId = JSON.parse(secondOrder).id;
check("first idempotent place succeeds", JSON.parse(firstOrder).ok === true, firstOrder);
check(
  "same idempotency key returns the same order",
  firstId === secondId && orderCount === "1",
  `${firstId} vs ${secondId} count=${orderCount}`,
);
check("duplicate key does not decrement stock twice", stockAfterIdem === "1", stockAfterIdem);

const payment = scalar(
  `SELECT payment_status || ',' || total::text FROM orders WHERE id = '${firstId}';`,
);
check(
  "payment fields are server-owned unpaid + computed total",
  payment === "unpaid,60.00",
  payment,
);

psql([
  "-c",
  `
CREATE OR REPLACE FUNCTION public.force_order_fail() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'forced_order_failure';
END;
$$;
CREATE TRIGGER force_order_fail BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.force_order_fail();
`,
]);
const stockBeforeFail = scalar(`SELECT stock_quantity FROM menu_items WHERE id = '${itemId}';`);
let failedPlace = "";
try {
  failedPlace = place(userB, 1, "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
} catch (error) {
  failedPlace = String(error.message);
}
const stockAfterFail = scalar(`SELECT stock_quantity FROM menu_items WHERE id = '${itemId}';`);
check(
  "failed transaction rolls stock back",
  stockAfterFail === stockBeforeFail && /forced_order_failure/.test(failedPlace),
  `${stockBeforeFail}->${stockAfterFail} ${failedPlace}`,
);
psql(["-c", "DROP TRIGGER force_order_fail ON public.orders;"]);

const otherUser = place(userB, 1, idemKey);
check(
  "another user_id with the same key is a distinct order at SQL layer",
  JSON.parse(otherUser).ok === true && JSON.parse(otherUser).id !== firstId,
  otherUser,
);
check(
  "application must bind p_user_id from verified JWT (service_role RPC is trusted)",
  readFileSync(join(ROOT, "src/lib/orders.functions.ts"), "utf8").includes("p_user_id: userId"),
);

const anonDenied = spawnSync(
  "sudo",
  [
    "-u",
    "postgres",
    "psql",
    "-d",
    DB,
    "-t",
    "-A",
    "-c",
    "SET ROLE anon; SELECT consume_email_otp('x','y', now());",
  ],
  { encoding: "utf8" },
);
check(
  "anon cannot execute consume_email_otp",
  anonDenied.status !== 0,
  anonDenied.stderr || anonDenied.stdout,
);

const parallelEmail = "9".repeat(64);
const parallelCode = "8".repeat(64);
scalar(
  `SELECT issue_email_otp('${parallelEmail}', '${parallelCode}', '${t61}'::timestamptz)::text;`,
);
const consumeSql = `SELECT consume_email_otp('${parallelEmail}', '${parallelCode}', '${t61}'::timestamptz);`;
const raced = execFileSync(
  "bash",
  [
    "-lc",
    `out=$(mktemp -d); sudo -u postgres psql -d ${DB} -t -A -q -c ${JSON.stringify(consumeSql)} > "$out/a" & sudo -u postgres psql -d ${DB} -t -A -q -c ${JSON.stringify(consumeSql)} > "$out/b" & wait; printf '%s\\n' "$(tr -d '\\n' < "$out/a")" "$(tr -d '\\n' < "$out/b")"`,
  ],
  { encoding: "utf8" },
);
const racedLines = raced
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean)
  .filter(
    (line) => line === "match" || line === "missing" || line === "mismatch" || line === "expired",
  );
const matchCount = racedLines.filter((line) => line === "match").length;
const otherCount = racedLines.filter((line) => line !== "match").length;
check(
  "parallel consume allows only one match",
  matchCount === 1 && otherCount === 1,
  racedLines.join(","),
);

const rateKey = "d".repeat(64);
const rateT0 = "2026-08-26T12:00:00Z";
const rateT1 = "2026-08-26T12:00:01Z";
check(
  "rate limit first hit allowed",
  scalar(
    `SELECT consume_request_rate_limit('${rateKey}', 2, 60, '${rateT0}'::timestamptz)::text;`,
  ) === "true",
);
check(
  "rate limit second hit allowed",
  scalar(
    `SELECT consume_request_rate_limit('${rateKey}', 2, 60, '${rateT1}'::timestamptz)::text;`,
  ) === "true",
);
check(
  "rate limit third hit denied",
  scalar(
    `SELECT consume_request_rate_limit('${rateKey}', 2, 60, '${rateT1}'::timestamptz)::text;`,
  ) === "false",
);
const anonRate = spawnSync(
  "sudo",
  [
    "-u",
    "postgres",
    "psql",
    "-d",
    DB,
    "-t",
    "-A",
    "-c",
    `SET ROLE anon; SELECT consume_request_rate_limit('${rateKey}', 2, 60, now());`,
  ],
  { encoding: "utf8" },
);
check(
  "anon cannot execute consume_request_rate_limit",
  anonRate.status !== 0,
  anonRate.stderr || anonRate.stdout,
);

if (failed > 0) {
  console.error(`${failed} SQL RPC check(s) failed.`);
  process.exit(1);
}
console.log("All local SQL RPC checks passed.");
