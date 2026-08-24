# Security Checklist

Legend: `[PASS]` verified or implemented, `[WARNING]` requires deployment/architecture action, `[FAIL]` active blocker.

## Authentication

- [PASS] Supabase verifies JWT signature and claims server-side.
- [PASS] Server functions derive identity from verified claims, not client role flags.
- [PASS] Application tables do not store plaintext passwords.
- [PASS] OTP expiration, cooldown, hourly send, and failed-attempt limits exist.
- [PASS] Password reset is delegated to Supabase Auth.
- [PASS] Founder TOTP/backup-code checks are server-side.
- [WARNING] Browser sessions remain in `localStorage`; migrate to HttpOnly/Secure/SameSite SSR sessions.
- [WARNING] Direct password login/reset throttling depends on Supabase Auth configuration.

## Authorization and data access

- [PASS] RLS is enabled across application tables.
- [PASS] Customer orders and addresses are owner-scoped.
- [PASS] Vendor data is assignment/restaurant-scoped.
- [PASS] Founder operations perform server-side founder checks.
- [PASS] Direct authenticated role writes are revoked.
- [PASS] Founder role changes use a server-only service-role client after authorization.
- [PASS] Order detail applies an explicit owner predicate (BOLA defense).
- [WARNING] Review future schema columns before adding them to public `SELECT` lists.

## API security

- [PASS] Server functions have Zod input validation.
- [PASS] Global server-function rate limiting is enabled.
- [PASS] Sensitive OTP, registration, backup-code, login-log, and order limits are tighter.
- [PASS] TanStack CSRF middleware protects server-function requests.
- [PASS] No wildcard CORS policy is configured.
- [PASS] Body and upload data have bounded validation.
- [PASS] Generic public error responses avoid stack/database/secret leakage.
- [WARNING] Configure Cloudflare edge request/body limits and WAF rules.

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

- [PASS] Android cleartext and mixed content are disabled.
- [PASS] WebView debugging, file access, content access, and third-party cookies are disabled.
- [PASS] Top-level WebView navigation is host-allowlisted; external links leave the WebView.
- [PASS] Geolocation is granted only to the production app origin.
- [PASS] TLS validation errors cancel navigation.
- [PASS] Android backup/data transfer is disabled for WebView session data.
- [WARNING] OAuth/provider behavior must be retested on a physical device after navigation allowlisting.

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

