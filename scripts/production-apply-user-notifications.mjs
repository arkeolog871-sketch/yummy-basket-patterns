#!/usr/bin/env node
/**
 * Apply notification migrations to production Supabase:
 *   1) user_notifications + device_push_tokens
 *   2) notification_broadcasts + token uniqueness
 * Refuses unless:
 *   ALLOW_PRODUCTION_ORDER_MIGRATION=YES
 *   PRODUCTION_DATABASE_URL=postgresql://...wxkyhwkcuiqxxxpawcid...
 *
 * Never disables RLS. Never inserts data. Never prints the connection URL.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PRODUCTION_PROJECT_REF, looksLikeProduction } from "./lib/env-safety.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILE_PUSH = join(ROOT, "supabase/migrations/20260828200000_user_notifications_push.sql");
const FILE_BROADCASTS = join(
  ROOT,
  "supabase/migrations/20260830120000_notification_broadcasts.sql",
);
const url = process.env.PRODUCTION_DATABASE_URL || "";
const allowed = process.env.ALLOW_PRODUCTION_ORDER_MIGRATION === "YES";

if (!allowed) {
  console.error(
    "BLOCKED: set ALLOW_PRODUCTION_ORDER_MIGRATION=YES to apply this file to production.",
  );
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

console.log("Preflight: user_notifications (no data rewrite).");
psql(["-f", FILE_PUSH]);

const notifTable = scalar(
  "SELECT count(*) FROM pg_class WHERE relname = 'user_notifications' AND relnamespace = 'public'::regnamespace;",
);
const tokenTable = scalar(
  "SELECT count(*) FROM pg_class WHERE relname = 'device_push_tokens' AND relnamespace = 'public'::regnamespace;",
);
const dedup = scalar(`
  SELECT count(*) FROM pg_constraint
  WHERE conrelid = 'public.user_notifications'::regclass
    AND contype = 'u'
    AND pg_get_constraintdef(oid) ILIKE '%user_id%dedup_key%';
`);
const rlsNotif = scalar(
  "SELECT relrowsecurity FROM pg_class WHERE relname = 'user_notifications' AND relnamespace = 'public'::regnamespace;",
);
const rlsToken = scalar(
  "SELECT relrowsecurity FROM pg_class WHERE relname = 'device_push_tokens' AND relnamespace = 'public'::regnamespace;",
);
const published = scalar(
  "SELECT count(*) FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='user_notifications';",
);

console.log(
  `user_notifications=${notifTable} device_push_tokens=${tokenTable} dedup=${dedup} rls_notif=${rlsNotif} rls_token=${rlsToken} realtime=${published}`,
);

if (
  notifTable !== "1" ||
  tokenTable !== "1" ||
  dedup !== "1" ||
  rlsNotif !== "t" ||
  rlsToken !== "t" ||
  published !== "1"
) {
  console.error("FAIL user_notifications migration postconditions.");
  process.exit(1);
}
console.log("Applied 20260828200000_user_notifications_push.sql");

console.log("Preflight: notification_broadcasts (no data rewrite).");
psql(["-f", FILE_BROADCASTS]);

const broadcastTable = scalar(
  "SELECT count(*) FROM pg_class WHERE relname = 'notification_broadcasts' AND relnamespace = 'public'::regnamespace;",
);
const idempotency = scalar(`
  SELECT count(*) FROM pg_constraint
  WHERE conrelid = 'public.notification_broadcasts'::regclass
    AND contype = 'u'
    AND pg_get_constraintdef(oid) ILIKE '%idempotency_key%';
`);
const rlsBroadcast = scalar(
  "SELECT relrowsecurity FROM pg_class WHERE relname = 'notification_broadcasts' AND relnamespace = 'public'::regnamespace;",
);
const tokenUnique = scalar(`
  SELECT count(*) FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'device_push_tokens'
    AND indexname = 'device_push_tokens_token_unique';
`);

console.log(
  `notification_broadcasts=${broadcastTable} idempotency=${idempotency} rls_broadcast=${rlsBroadcast} token_unique=${tokenUnique}`,
);

if (broadcastTable !== "1" || idempotency !== "1" || rlsBroadcast !== "t" || tokenUnique !== "1") {
  console.error("FAIL notification_broadcasts migration postconditions.");
  process.exit(1);
}
console.log("Applied 20260830120000_notification_broadcasts.sql");
