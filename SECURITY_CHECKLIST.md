# Security Checklist

Legend: `[PASS]` verified or implemented, `[WARNING]` requires deployment/architecture action, `[FAIL]` active blocker.

## Authentication

- [PASS] Supabase verifies JWT signature and claims server-side.
- [PASS] Server functions derive identity from verified claims, not client role flags.
- [PASS] Application tables do not store plaintext passwords.
- [PASS] OTP expiration, cooldown, hourly send, failed-attempt limits, exact 6-digit parse, consume-on-match, and undelivered-code invalidation exist.
- [PASS] Password reset is delegated to Supabase Auth.
- [PASS] Founder TOTP/backup-code checks are server-side.
- [PASS] Unverified sessions cannot use customer order/address APIs or those routes.
- [WARNING] Browser sessions remain in `localStorage`; migrate to HttpOnly/Secure/SameSite SSR sessions.
- [WARNING] Direct password login/reset throttling depends on Supabase Auth configuration.

## Authorization and data access

- [PASS] RLS is enabled across application tables.
- [PASS] Customer orders and addresses are owner-scoped.
- [PASS] Vendor data is assignment/restaurant-scoped.
- [PASS] Founder operations perform server-side founder checks.
- [PASS] Direct authenticated role writes are revoked.
- [PASS] Founder role changes use a server-only service-role client after authorization.
- [PASS] Founder bootstrap requires an exact deployment-time email allowlist and a unique founder index.
- [PASS] Order detail applies an explicit owner predicate (BOLA defense).
- [PASS] Direct authenticated order and order-item writes are revoked; server-side order creation recomputes totals.
- [PASS] Vendor reassignment revokes the previous vendor assignment and vendor role.
- [PASS] Anonymous catalog reads omit `stock_quantity`.
- [PASS] Authenticated catalog reads omit `stock_quantity`; authorized dashboards use the server-only client.
- [PASS] Vendor restaurant updates are limited to `is_open_manual`, `logo_url`, and `cover_image_url`.
- [PASS] Backup-code hashes are not readable through the authenticated PostgREST role.
- [PASS] Backup-code redemption uses a conditional unused-row update.
- [WARNING] Review future schema columns before adding them to public `SELECT` lists.

## API security

- [PASS] Server functions have Zod input validation.
- [PASS] Global server-function rate limiting is enabled.
- [PASS] Sensitive OTP, registration, backup-code, login-log, and order limits are tighter.
- [PASS] Rate-limit identity prefers `cf-connecting-ip` and ignores spoofable `X-Forwarded-For` / `X-Real-IP`.
- [PASS] TanStack CSRF middleware protects server-function requests.
- [PASS] No wildcard CORS policy is configured.
- [PASS] Body and upload data have bounded validation.
- [PASS] Generic public error responses avoid stack/database/secret leakage.
- [PASS] OTP issue/consume/failure counters use row-locked RPCs plus an advisory transaction lock and compare-and-swap consume (`20260825230000_otp_advisory_lock_cas.sql`). A non-atomic fallback remains if those functions are not yet deployed.
- [PASS] Vendor login success bodies use a single generic mask for known and unknown identifiers.
- [PASS] Order placement uses a transactional stock+idempotency RPC (`place_customer_order`) with a fallback insert path.
- [WARNING] Configure Cloudflare edge request/body limits and WAF rules.
- [WARNING] Apply `20260825223000_otp_order_atomic_rpc.sql` and `20260825230000_otp_advisory_lock_cas.sql` on a dedicated staging project first. This agent could not apply them: no staging credentials were present, and the only known project ref is production. Until applied, the app may use non-atomic fallbacks.

## Injection and browser security

- [PASS] No string-built SQL queries found; Supabase query builders are used.
- [PASS] User content is rendered through React escaping.
- [PASS] Map popup values are HTML-escaped.
- [PASS] Uploads validate decoded magic bytes and size.
- [PASS] SVG branding input rejects scripts, event attributes, foreign objects, and HTML data.
- [PASS] CSP, frame protection, `nosniff`, HSTS, referrer and permissions policies are defined.
- [WARNING] CSP still uses `unsafe-inline` for current SSR/dev runtime compatibility.
- [PASS] Public storage paths reject traversal and invalid path shapes.

## File and storage security

- [PASS] Service-role client is server-only and not used in browser modules.
- [PASS] Media bucket/path allowlists are enforced by proxy routes.
- [PASS] Vendor upload and deletion operations require vendor authorization.
- [PASS] Android signing material is removed from the checkout and ignored.
- [WARNING] Existing published Git history contained signing material; rotate the key operationally.

## Mobile security

- [PASS] Android cleartext and mixed content are disabled (`usesCleartextTraffic=false`, `MIXED_CONTENT_NEVER_ALLOW`).
- [PASS] WebView debugging and `file://` access are disabled. Content access stays on for gallery/camera `content://` URIs.
- [PASS] JavaScript and DOM storage are enabled because the product is a WebView-hosted SPA; there is no separate native UI.
- [WARNING] Third-party cookies are **enabled** in the WebView so Google OAuth / Custom Tabs cookie handoff can complete. This is intentional and documented; do not disable it without a physical-device OAuth retest.
- [PASS] Top-level WebView navigation is host-allowlisted; Google authorize URLs open in Custom Tabs; other external links leave the WebView.
- [PASS] Geolocation is granted only to the production app origin.
- [PASS] TLS validation errors cancel navigation.
- [PASS] Android backup/data transfer is disabled for WebView session data.
- [WARNING] Login → signup → OTP → session → address → order must be retested on a physical Android device before production GO.

## Secrets and dependencies

- [PASS] `.env` is ignored and an uncredentialed `.env.example` is provided.
- [PASS] Service-role credentials are read only from server environment variables.
- [PASS] Android signing credentials are read from secret environment variables/Gradle properties.
- [PASS] `bun audit` reports no known vulnerabilities after compatible updates.
- [WARNING] Rotate credentials that were exposed in historical commits; do not rewrite Lovable-published history.

## OWASP mapping

- [PASS] A01 Broken Access Control: owner predicates, vendor scope, RLS, founder checks.
- [PASS] A02 Cryptographic Failures: no plaintext app passwords; signing secrets removed from source.
- [PASS] A03 Injection: validated inputs, query builders, escaped popup HTML.
- [PASS] A04 Insecure Design: server-side authorization and bounded uploads/rate limits.
- [PASS] A05 Security Misconfiguration: headers, CSP, probe blocking, mobile transport hardening.
- [PASS] A06 Vulnerable Components: dependency audit fixed compatible findings.
- [PASS] A07 Identification/Auth Failures: JWT claim verification, OTP limits, MFA gate.
- [PASS] A08 Software/Data Integrity: protected role writes and externalized signing.
- [PASS] A09 Logging/Monitoring: audit events with centralized redaction.
- [WARNING] A10 SSRF: no server-side arbitrary URL fetch was found; keep future fetches allowlisted.
- [PASS] API1/API3/API5/API6: object/function authorization, validation, mass-assignment controls.
- [PASS] API4/API7: rate limits and generic errors.
- [WARNING] API8/API10: configure production inventory and Cloudflare edge controls.
