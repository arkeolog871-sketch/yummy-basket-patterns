# Cloudflare edge checklist

Do **not** assume these rules already exist. This repository only prefers `cf-connecting-ip` for application rate limits (`src/lib/trusted-ip.ts`). Edge WAF, Turnstile, and origin lockdown are **operator configuration**, not application code.

Verify in the Cloudflare dashboard (Free plan is enough for the items below). Check each box only after the control is actually enabled on `uygulamamcebimde.online`.

## Proxy and origin

- [ ] Orange-cloud proxy is on for the apex and `www`.
- [ ] Origin IP is not reachable on 80/443 except from Cloudflare (firewall, authenticated origin pulls, or Cloudflare Tunnel). Direct origin access would bypass WAF and the app IP limiter.
- [ ] SSL/TLS mode is Full (strict) with a valid origin certificate.
- [ ] Always Use HTTPS is on.
- [ ] HSTS is enabled at the edge **or** the application `Strict-Transport-Security` header is the source of truth (do not send conflicting max-age values).
- [ ] Minimum TLS 1.2.

## WAF / managed rules

- [ ] Cloudflare managed OWASP/core ruleset enabled.
- [ ] Block obvious CMS/php probes (`/wp-admin`, `/.env`, `/.git`) if the application 404 is not already sufficient.
- [ ] Challenge or block traffic that posts to auth/OTP endpoints from known bot scores (do not lock out the Android WebView UA `SilvanCebimde`).

## Rate limiting (edge, shared across instances)

Application limits are in-memory per instance. Edge limits must exist independently:

- [ ] `/auth` and OTP send/verify server-function POSTs: tight per-IP threshold (example starting point: 10 POSTs / minute, then 429 or managed challenge).
- [ ] Registration POSTs: stricter than login.
- [ ] Checkout/order POSTs: moderate limit so a retry storm cannot oversell via the fallback path.
- [ ] Global request rate for the zone as a backstop.
- [ ] Bypass or higher ceiling for health checks only from known probes.

## Turnstile

- [ ] Turnstile widget on registration, password login, and OTP send (staging first).
- [ ] `TURNSTILE_SECRET_KEY` is server-only (already listed in `.env.example`). Never a `VITE_` key.
- [ ] Android WebView must complete the widget; if it cannot, keep a documented exception rather than silently skipping verification.

## Headers and body

- [ ] Request body size cap at the edge (uploads already have app-side byte limits).
- [ ] Confirm `_headers` / application CSP still apply when proxied (no header stripping).
- [ ] Strip incoming `X-Forwarded-For` / `X-Real-IP` at the trusted edge so only `CF-Connecting-IP` is meaningful. The app limiter already ignores spoofed forwarded headers.

## Android App Links (www)

Google’s Digital Asset Links crawler **does not follow redirects**. If `www` 302s to apex, `https://www.uygulamamcebimde.online/.well-known/assetlinks.json` will fail verification even when apex serves a valid JSON file.

- [ ] Apex `https://uygulamamcebimde.online/.well-known/assetlinks.json` returns `200` + `Content-Type: application/json` (not the SPA HTML 404).
- [ ] `www` either also returns the same JSON with `200` **without** a 302, or you accept that only the apex host can `autoVerify`.
- [ ] SHA-256 in that JSON is the **Play App Signing** cert (not a placeholder). Empty `sha256_cert_fingerprints` means App Links stay unverified.

## What the app must not pretend

- Presence of `cf-connecting-ip` in code does **not** mean WAF, Turnstile, or origin lockdown are on.
- In-memory `src/lib/rate-limit.server.ts` is not a substitute for Cloudflare rate rules.
- Production GO stays **NO** until an operator confirms the boxes above (or accepts the warning in the GO report).
