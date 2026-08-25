# Staging runbook (OTP + order RPCs)

Production project ref in `supabase/config.toml` is treated as **production**. This agent will not apply migrations there.

## Why migrations were not applied from the cloud agent

This environment has **no** `STAGING_DATABASE_URL`, `STAGING_SUPABASE_DB_URL`, `STAGING_APP_URL`, or mailbox secrets. Applying SQL to the only known project (`wxkyhwkcuiqxxxpawcid`) would be a production write. That is forbidden.

## Operator steps (staging project only)

1. Create a separate Supabase project (or restore a snapshot). Do not reuse the production ref.
2. Set secrets locally (never commit):
   - `STAGING_DATABASE_URL` — direct or pooler URI for that project
   - `STAGING_APP_URL` — HTTPS origin that is **not** `uygulamamcebimde.online`
   - mailbox IMAP + `STAGING_TEST_EMAIL` / `STAGING_TEST_PASSWORD`
3. Apply historical migrations to the empty staging project first (Supabase CLI `db push` against staging).
4. Then:

```bash
node scripts/staging-migrate.mjs
```

The script refuses URLs that contain `wxkyhwkcuiqxxxpawcid` or `uygulamamcebimde.online`.

5. Confirm RPCs:

```sql
SELECT proname FROM pg_proc
WHERE proname IN (
  'issue_email_otp',
  'consume_email_otp',
  'register_email_otp_failure',
  'place_customer_order'
);

SELECT pg_get_functiondef('public.consume_email_otp(text,text,timestamptz)'::regprocedure);
-- must contain pg_advisory_xact_lock and a CAS UPDATE on code_hash
```

6. Seed a restaurant with known `stock_quantity` for oversell/idempotency tests. Do not copy production PII.
7. Run mailbox E2E against `STAGING_APP_URL` only:

```bash
STAGING_APP_URL=https://your-staging.example \
STAGING_TEST_EMAIL=... \
STAGING_MAILBOX_IMAP_HOST=... \
STAGING_MAILBOX_USER=... \
STAGING_MAILBOX_PASSWORD=... \
STAGING_OTP_CODE=123456 \
bunx playwright test tests/e2e/staging-mailbox.spec.ts
```

## Cases that must pass on staging before GO

OTP: 5-digit reject, 7-digit reject, letters reject, wrong code, expired code, single consume, 5-failure lock, parallel consume, 60s resend cooldown.

Orders: oversell reject, idempotency key uniqueness per user, stock restored on forced failure, JWT `user_id` bind, vendor `restaurant_id` bind, payment fields not client-writable.

Local SQL (`bun run test:sql`) covers the RPC/CAS/stock subset without touching staging data. It does **not** replace mailbox E2E.
