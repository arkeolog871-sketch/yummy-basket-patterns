# Android physical device test plan

This plan is for a **physical** phone, not an emulator screenshot. The cloud agent cannot complete it. Record pass/fail per row before production GO.

Build: signed release APK from `android-wrapper` using rotated keystore secrets (historical keystore in git is compromised).

Install: sideload or internal track. Confirm Play Protect / OEM WebView version.

## Transport

| Step | Expected | Result |
| --- | --- | --- |
| Airplane mode then Wi-Fi to `https://uygulamamcebimde.online/` | Home loads over HTTPS | |
| Charles/mitm with user CA | TLS error; page does not load (`onReceivedSslError` → cancel) | |
| `http://uygulamamcebimde.online/` if attempted | Cleartext blocked | |

## Session and JavaScript

| Step | Expected | Result |
| --- | --- | --- |
| Cold start | SPA renders (JS required) | |
| Login with password on a verified account | Session survives app backgrounding | |
| Force-stop app and reopen | Session still present (`localStorage`) | |
| Logout | Returns to guest catalog; protected routes ask for login | |

## Custom Tabs vs WebView (Google OAuth)

| Step | Expected | Result |
| --- | --- | --- |
| Tap Google giriş | Chrome Custom Tabs (or default browser), not an in-WebView Google page | |
| Complete Google account chooser | Returns to `https://uygulamamcebimde.online/auth` or `silvancebimde://oauth` | |
| After return | Logged-in session inside the **WebView**, not only in Chrome | |
| Repeat with Chrome disabled/missing | Fallback browser or a visible error, not a blank WebView | |

Third-party cookies are **on** in `MainActivity.java` for this path. If OAuth works with them off on this device, document it; do not change the default in the same release as GO.

## OTP flow (use a real mailbox you control; never production brute-force)

| Step | Expected | Result |
| --- | --- | --- |
| Signup | Account created; 6-digit mail arrives | |
| 5 digits | Doğrula stays disabled / rejected | |
| 7 digits | Field caps at 6 | |
| Letters | Rejected | |
| Wrong 6-digit code | Error; account not verified | |
| Correct code | Session; email verified | |
| Same code again | Rejected | |
| Address save | Succeeds only while logged in | |
| Place an order on **staging** | Confirmed order; stock decreases once | |
| Logout then login | Returns to the same account | |

Do **not** run lockout (5 wrong tries) or parallel-consume tests against production. Those belong on staging.

## Orders

| Step | Expected | Result |
| --- | --- | --- |
| Checkout without login | Redirect/gate to login | |
| Checkout with unverified email | OTP gate, no order | |
| Verified checkout | Order appears under Siparişlerim | |

## Fail / notes

Record WebView version (`Android System WebView` or Chrome), Android version, and a screen recording of login → OTP → order on staging.
