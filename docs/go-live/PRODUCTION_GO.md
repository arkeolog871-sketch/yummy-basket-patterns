# PRODUCTION GO rapor (PR #53)

Tarih: 2026-08-25. Production verisine yazılmadı. Secret/key değerleri yazdırılmadı.

## PRODUCTION GO: NO

Staging mailbox OTP E2E, staging sipariş E2E ve fiziksel Android WebView henüz koşturulamadı. RPC migration’ları production’a uygulanmadı (bilinçli). Staging kimliği bu ortamda yok.

Migration uygulanamama nedeni: bu agent ortamında `STAGING_DATABASE_URL` / `STAGING_APP_URL` yok. Bilinen tek Supabase proje ref’i `supabase/config.toml` içindeki production projesidir. Oraya SQL uygulamak production yazması olurdu.

## PASS

- OTP parse: 5 hane, 7 hane, harf içeren kod `parseExactOtpCode` ile reddediliyor (`tests/unit/otp.test.ts`).
- OTP guard: 60 sn cooldown, saatlik 5 gönderim, 10 dk TTL, 5 hatalı denemede kilit, consume-on-match, undelivered invalidate, in-memory CAS (`tests/unit/otp-guard.test.ts`).
- Yerel Postgres RPC (izole `silvan_rpc_test`, staging/production değil):
  - `consume_email_otp` advisory lock + CAS UPDATE
  - cooldown bypass edilemiyor
  - yanlış / expired / replay reddi
  - 5 failure sonrası hash siliniyor
  - paralel iki consume’da yalnızca biri `match`
  - stoktan fazla sipariş reddi, stok değişmiyor
  - aynı kullanıcı + aynı idempotency key tek sipariş
  - başarısız transaction stoku geri alıyor
  - `payment_status` sunucu default `unpaid`; total sunucuda hesaplanıyor
  - `anon` `consume_email_otp` çağıramıyor
- Sipariş Zod şemasında `user_id` / ödeme / total yok; `p_user_id` JWT `userId`; vendor `assertVendor` restaurant_id’si (`tests/unit/order-input-security.test.ts`, `tests/unit/idor.test.ts`).
- Rate limit yalnızca `cf-connecting-ip`; `X-Forwarded-For` / `X-Real-IP` yok sayılıyor.
- Android: HTTPS, cleartext kapalı, mixed content never, debugging kapalı, JS SPA için açık, third-party cookie OAuth için açık ve belgelenmiş.
- Production GET-only smoke: home 200, probe 404, güvenlik başlıkları, CORS kapalı, Cloudflare proxy başlığı var. OTP/sipariş/stok yok.
- Vitest: 66/66. `tsc --noEmit` temiz.
- Playwright (yerel, production değil): 36 geçti, staging mailbox 4 test skip.

## BLOCKED

- Staging projesi / `STAGING_DATABASE_URL` yok; `20260825223000_otp_order_atomic_rpc.sql` ve `20260825230000_otp_advisory_lock_cas.sql` staging’e uygulanamadı.
- Staging gerçek mailbox E2E (signup → 6 hane OTP → session → adres → sipariş → logout → login) koşturulamadı.
- Staging’de canlı IDOR (başka `user_id` / başka `restaurant_id`) iki hesapla doğrulanamadı.
- Fiziksel Android cihazda WebView + Custom Tabs + OTP + sipariş yok.
- Production’da RPC’lerin uygulanıp uygulanmadığı anon OpenAPI ile doğrulanamadı (401; service-role RPC’ler zaten gizli olabilir). Production’a migration basılmadı.
- Production OTP tüketme, brute-force, sipariş, stok düşürme yapılmadı (kural).

## WARNING

- Migration’lar production’da yoksa uygulama hâlâ RMW OTP ve non-transactional sipariş fallback kullanır. Fallback stok düşürmez; oversell koruması RPC’siz zayıf kalır.
- Tarayıcı oturumu `localStorage` (XSS ile çalınabilir). HttpOnly kesimi **otomatik uygulanmadı**; bkz. `docs/go-live/SESSION_SECURITY_MIGRATION.md`.
- In-memory IP limiter instance’lar arası paylaşılmaz.
- CSP `unsafe-inline`.
- Android third-party cookie açık (OAuth). Fiziksel cihaz doğrulaması yok.
- Historical Android keystore git geçmişinde; rotate edilmeli, history rewrite yok.
- Audit/error log IP’si hâlâ `x-forwarded-for` fallback kullanabilir (limiter kullanmaz).
- Cloudflare WAF/rate-limit/Turnstile/origin lockdown kodda yok; dashboard onayı yok. Proxy başlığı production GET’te görüldü, kurallar doğrulanmadı.

## STAGING TEST

- `node scripts/staging-migrate.mjs` → BLOCKED (credential yok). Production SQL’sine dokunulmadı.
- `tests/e2e/staging-mailbox.spec.ts` staging origin + mailbox olmadan skip.
- Yerel SQL RPC alt kümesi PASS (yukarıda). Mailbox/UI/IDOR canlı staging değil.

## ANDROID PHYSICAL DEVICE

- Statik kod incelemesi PASS (HTTPS, cleartext off, JS gerekli, Custom Tabs, cookie kararı belgelendi).
- Fiziksel cihaz: NOT RUN. Plan: `docs/go-live/ANDROID_PHYSICAL_DEVICE.md`.

## CLOUDFLARE

- Kod varsayımı yok. Checklist: `docs/go-live/CLOUDFLARE_CHECKLIST.md`.
- Production GET: Cloudflare proxy başlığı var.
- WAF, rate-limit, Turnstile, origin lockdown: NOT VERIFIED (dashboard erişimi yok).

## SESSION SECURITY

- `persistSession: true` + `localStorage` / Lovable preview broker. Değiştirilmedi.
- HttpOnly/Secure/SameSite planı: `docs/go-live/SESSION_SECURITY_MIGRATION.md`. Otomatik migration yok.
