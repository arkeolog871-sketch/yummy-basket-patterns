# Security Audit

**Scope:** Full repository review of the React/TanStack Start application, Supabase/PostgreSQL schema and RLS policies, server functions, public storage routes, and Android WebView wrapper.

**Architecture note:** The repository does not contain an Express server. The backend boundary is TanStack Start server functions/routes backed by Supabase. The controls below are applied at that boundary.

## Executive summary

- Active CRITICAL findings after this change: **0**
- Active HIGH findings after this change: **0**
- Findings identified: **12**
- Findings remediated in code: **10**
- Remaining deployment/configuration warnings: **4**
- Database destructive data changes: **none**

The most serious finding was a committed Android release keystore and hard-coded signing passwords. The material is removed from the working tree and future builds require externally supplied secrets. Because published Git history must not be rewritten for the Lovable-connected repository, the old signing key must be rotated and the exposed key treated as compromised.

## Findings and remediations

### CRITICAL — Android signing material committed

**Evidence:** `android-wrapper/app/silvan-cebimde.keystore`, `android-wrapper/app/build.gradle.kts`.

The release keystore and its passwords were present in the repository. Anyone with repository/history access could sign a malicious APK using the package identity. The keystore is deleted from the checkout, ignored by Git, and Gradle now reads signing values only from environment variables or Gradle properties. `build-apk.sh` refuses an unsigned release build.

**Required operational action:** revoke/rotate the exposed signing material. Preserve a new signing key in encrypted secret storage. Android updates require continuity of the signing identity; coordinate key rotation with the distribution channel before publishing.

### HIGH — WebView origin and transport trust

**Evidence:** `android-wrapper/app/src/main/java/online/uygulamamcebimde/app/MainActivity.java`.

The wrapper previously allowed mixed content, third-party cookies, unrestricted top-level navigation, and granted geolocation to any requesting origin. It now rejects cleartext/mixed content, disables third-party cookies and WebView debugging, restricts geolocation to the production host, rejects TLS errors, disables file/content URL access, and opens non-app destinations externally.

### HIGH — Role-management privilege escalation

**Evidence:** initial `user_roles` RLS policies and role-management server functions.

The legacy authenticated admin policy could have allowed direct role manipulation, including escalation toward founder. The hardening migration removes broad admin role policies and revokes authenticated INSERT/UPDATE/DELETE privileges. Founder role changes use the server-only service-role client only after `assertFounder`.

### CRITICAL — Public founder bootstrap takeover

**Evidence:** `src/lib/founder.functions.ts`, `src/routes/kurucu.tsx`.

The first verified account could previously claim founder when no founder existed. Self-claim is now restricted to exact addresses in the deployment-only `FOUNDER_BOOTSTRAP_EMAILS` allowlist, and the database has an unconditional single-founder unique index. The UI no longer presents self-claim as an open registration path.

### HIGH — Forged orders through direct PostgREST writes

**Evidence:** order table grants and `src/lib/orders.functions.ts`.

Authenticated clients could insert orders/order items directly with client-controlled totals and payment fields. Authenticated order writes are now revoked. The existing server-side order path uses the service-role client only after verified-email, restaurant, availability, stock, price, minimum-order, and total checks. A transactional stock/idempotency RPC remains a recommended next step.

### HIGH — Stale vendor access after ownership change

**Evidence:** `src/lib/founder.server.ts`.

Changing a restaurant contact email previously returned early when an assignment existed, leaving the old vendor assigned. The existing assignment is now compared with the new account and the old vendor assignment/role is revoked before the new account is linked.

### MEDIUM — Missing endpoint-wide rate limiting

Server functions previously relied mainly on per-email OTP guards and audit-derived limits. A bounded in-memory edge-safe limiter now covers all server functions by client address, with tighter limits for registration, OTP, vendor OTP, backup codes, founder login logging, and order creation. Cloudflare’s `cf-connecting-ip` is preferred.

This is defense-in-depth, not a replacement for Supabase Auth limits or Cloudflare rate rules. Multiple serverless instances do not share memory.

### MEDIUM — Upload content trusted from declared MIME

Image uploads now validate base64 syntax, decoded byte size, and file signatures for PNG/JPEG/WebP/AVIF/ICO. Branding SVG uploads are constrained and reject scripts, event attributes, external HTML data, and foreign objects.

### MEDIUM — Public storage proxy accepted overly broad paths

The public media and branding proxy routes use the service-role client by design for public assets. They now accept only allowlisted bucket/path shapes, reject traversal/backslashes, send `nosniff`, and apply a restrictive SVG response CSP.

### MEDIUM — Operational inventory exposed to anonymous catalog clients

Anonymous menu reads no longer receive `stock_quantity`; that field remains available to server-side vendor/founder dashboard reads through the service-role client.

### LOW — Missing defense-in-depth response headers

Server responses and Cloudflare static assets now include CSP, frame protection, HSTS, `nosniff`, referrer and permissions policies. CSP retains narrowly required third-party origins and `unsafe-inline` because the current SSR/dev runtime emits inline styles/scripts; a nonce-based CSP would require a larger rendering change.

### LOW — Dependency vulnerabilities

`bun audit` initially reported five high-severity transitive issues in `brace-expansion`, `js-yaml`, and `nanoid`. `bun audit fix` updated compatible lockfile versions. Final result: no vulnerabilities reported.

## Authentication and session status

- Supabase JWT signature and claims are verified server-side with `auth.getClaims`.
- Protected server functions require a bearer token and derive `userId` from verified claims.
- Critical order creation requires server-side verified email.
- OTPs are issued by Supabase, expire through the OTP guard policy, and are limited by cooldown/hourly/failed-attempt controls.
- Founder access checks role, verified email, and configured TOTP/backup-code state.
- Passwords are sent only to Supabase Auth; application tables do not store plaintext passwords.
- The browser Supabase client currently persists sessions in `localStorage`. This remains a **WARNING**: XSS would expose a browser session. A full HttpOnly-cookie migration requires adopting server-managed Supabase SSR sessions and should be planned before high-risk production use.
- Supabase Auth's built-in password-login and reset throttles remain relied upon for direct browser Auth API calls.
- The database OTP counters use row-locked RPCs (`issue_email_otp`, `consume_email_otp`, `register_email_otp_failure`) with a read/upsert fallback if those functions are not yet deployed.
- Vendor login success responses use one generic mask for known and unknown identifiers. SMTP failure on a known account is not distinguished from success.
- Order creation prefers `place_customer_order`, which locks menu rows, decrements stock, and honors an idempotency key. A non-transactional fallback remains until the migration is applied.

## Authorization, RBAC, and IDOR/BOLA

- Founder, vendor, and customer decisions are made server-side.
- Orders are scoped by `user_id`; order detail also applies an explicit owner predicate.
- Vendor reads/writes are scoped by `vendor_assignments` and restaurant ID.
- Addresses are scoped by `auth.uid()`.
- Founder/admin catalog and user operations require server-side founder checks.
- Public catalog rows are intentionally public; contact and operational fields should be reviewed before adding future columns.
- RLS is enabled on application tables and storage objects. The new migration removes direct authenticated role writes.
- Authenticated order/order-item write grants are revoked; server-side order creation is the only application write path.
- Authenticated clients receive only public menu columns; stock is available only to authorized server-side dashboards.
- Vendor restaurant updates are limited to storefront operation/logo columns; founder catalog writes use the server-only client.
- Backup-code status and redemption use the server-only client, and redemption is conditional on `used_at IS NULL`.

## API, injection, XSS, and CSRF

- Supabase query builders are used; no string-concatenated SQL was found.
- Server functions use Zod validators; unknown object fields are not used for mass assignment.
- React escaping is used for normal user content. The chart component's HTML style generation receives controlled IDs and validated color values.
- Map popup HTML is passed through `escapeHtml`.
- TanStack Start CSRF middleware protects server-function requests.
- No permissive `Access-Control-Allow-Origin: *` configuration exists. Same-origin browser APIs are the default.
- Error responses are converted to generic public messages; technical details stay in server logging.
- Request bodies do not receive a custom global parser limit in this repository; Cloudflare/platform limits should be configured before public launch.

## Logging and monitoring

Audit events cover authentication attempts, founder/vendor operations, role changes, user changes, catalog changes, and order status changes. Audit detail is now centrally redacted for passwords, tokens, secrets, authorization/cookie values, emails, and phone numbers.

Logs must still be retained with restricted access. The current audit table is application data, not an immutable SIEM.

## Cloudflare Free readiness

Implemented:

1. `cf-connecting-ip` is preferred for rate-limit identity.
2. Static `_headers` and server response headers are defined.
3. Probe paths are answered with generic 404 responses.
4. No wildcard CORS is enabled.

Remaining:

1. Put the origin behind Cloudflare and block direct origin access.
2. Add Cloudflare WAF/rate rules for `/auth`, server-function POST traffic, OTP, and upload routes.
3. Add Turnstile to registration, password reset, and suspicious login attempts. Keep `TURNSTILE_SECRET_KEY` backend-only.
4. Confirm HTTPS-only mode and HSTS behavior on the actual custom domain.
5. Configure upload and request-size limits at the edge.
6. OTP issue/consume/failure and order stock/idempotency RPCs are in `supabase/migrations/20260825223000_otp_order_atomic_rpc.sql`. Apply in staging first, then production. Until applied, the application falls back to the previous non-atomic paths.
7. Ensure rate-limit failures fail closed for security-critical flows and strip forwarded-IP headers at the trusted edge.

## Production deployment checklist

1. Rotate the exposed Android signing key/password and store the replacement in encrypted CI secrets.
2. Rotate any provider/API credentials that were ever committed; browser-restricted Google keys are not server secrets but must have referrer/API restrictions.
3. Set `SUPABASE_SERVICE_ROLE_KEY` only in the server/edge environment; never expose it through `VITE_*`.
4. Confirm `.env` and keystores are absent from the Git index and CI artifacts.
5. Enable Cloudflare proxy, WAF, rate rules, and origin lock-down.
6. Configure Supabase Auth email, redirect allowlist, password policy, OTP limits, and MFA policy.
7. Apply and verify all migrations, especially RLS and storage policies, in a staging project first.
8. Test the production CSP with Google Maps, Leaflet, Supabase Auth, OSM, image uploads, and OAuth.
9. Configure alerting for failed login, denied authorization, rate-limit, role-change, and upload events.
10. Plan migration from browser `localStorage` sessions to HttpOnly/Secure/SameSite server-managed sessions.
