# Session security migration plan

**Status:** plan only. Do **not** switch the live app from `localStorage` Supabase sessions to HttpOnly cookies in this PR.

## Current behavior

- Browser client: `persistSession: true` with `brokeredPreviewStorage()` in `src/integrations/supabase/client.ts`.
- On production (`uygulamamcebimde.online`) that storage is `localStorage`.
- On framed Lovable preview hosts it may broker the session to the editor via `postMessage` to a validated Lovable origin, then fall back to `localStorage`.
- Server auth clients use `persistSession: false` and do not keep a browser store (`src/lib/otp.server.ts`, server Supabase client).
- Android WebView uses the same SPA session (DOM storage + cookies). Custom Tabs OAuth returns to `/auth` and the WebView then writes the Supabase session into storage.

## Why this is not an automatic cutover

1. HttpOnly cookies require a server-managed session endpoint (set/clear cookie on login, OTP verify, Google OAuth exchange, and logout).
2. The Android WebView, Chrome Custom Tabs callback, and in-app `localStorage` refresh path must stay in lockstep. A cookie-only session that the WebView JavaScript cannot read will break `supabase.auth.getSession()` unless every client is moved to cookie-aware SSR.
3. Lovable preview session brokering depends on reading/writing the same storage keys.
4. A mixed rollout (some tabs cookie, some `localStorage`) can duplicate or drop sessions and look like random logouts.

## Risk if left as-is (WARNING, not a GO blocker by itself)

- Any XSS that runs on `uygulamamcebimde.online` can read `localStorage` and steal the refresh token.
- A malicious extension or rooted-device inspection can copy the same keys.
- CSRF is already mitigated for TanStack server functions; cookie sessions would need SameSite=Lax or Strict plus CSRF tokens on mutating routes.

## Target design (follow-up PR, staging first)

1. Adopt `@supabase/ssr` (or equivalent) on TanStack Start server routes.
2. Set cookies:
   - `Secure`
   - `HttpOnly`
   - `SameSite=Lax` (Strict will break the Custom Tabs → `/auth` return)
   - `__Host-` prefix once the site is HTTPS-only on the apex host
   - short-lived access cookie + rotating refresh cookie
3. Stop writing the refresh token to `localStorage` after a dual-run period.
4. Keep a one-release dual-read: accept existing `localStorage` sessions, re-issue cookies, then delete the old keys.
5. Android: confirm Custom Tabs callback still establishes a session after cookie migration. If the WebView cannot receive Set-Cookie from the OAuth return URL, keep a documented native exception rather than silently failing login.
6. Logout must clear cookies and `localStorage` remnants.

## Explicit non-goals for production GO of PR #53

- No automatic HttpOnly/Secure/SameSite cutover.
- No change to `brokeredPreviewStorage()` in this verification pass.
