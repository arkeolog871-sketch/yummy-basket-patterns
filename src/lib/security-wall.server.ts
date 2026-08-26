/** Uygulama güvenlik duvarı: tarama isteklerini keser, yanıt başlıklarını sıkılaştırır.
 * Kullanıcı akışını veya sayfa davranışını değiştirmez. */

export const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Permitted-Cross-Domain-Policies": "none",
  "Permissions-Policy": "geolocation=(self), camera=(self), microphone=(), payment=(), usb=(), interest-cohort=()",
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  "X-DNS-Prefetch-Control": "off",
  "X-Frame-Options": "SAMEORIGIN",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Content-Security-Policy":
    "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'self'; " +
    "form-action 'self' https://accounts.google.com https://accounts.google.com.tr; " +
    "script-src 'self' 'unsafe-inline' https://maps.googleapis.com https://maps.gstatic.com https://unpkg.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; " +
    "font-src 'self' data: https://fonts.gstatic.com https://unpkg.com; " +
    "img-src 'self' data: blob: https:; " +
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://oauth2.googleapis.com https://accounts.google.com " +
    "https://maps.googleapis.com https://unpkg.com " +
    "https://tile.openstreetmap.org ws://localhost:* ws://127.0.0.1:*; " +
    "frame-src 'self' https://www.openstreetmap.org https://accounts.google.com; " +
    "media-src 'self' blob: https:",
};

const BLOCKED_PATH =
  /(?:^|\/)(?:\.env(?:\..*)?|\.git|\.htaccess|wp-admin|wp-login\.php|xmlrpc\.php|phpmyadmin|server-status|actuator|vendor\/phpunit)(?:\/|$)/i;

/** Bilinen tarama / istismar yolları; uygulama rotalarına dokunmaz. */
export function isBlockedProbe(request: Request): boolean {
  try {
    return BLOCKED_PATH.test(new URL(request.url).pathname);
  } catch {
    return false;
  }
}

export function blockedProbeResponse(): Response {
  return new Response("Not found", {
    status: 404,
    headers: {
      ...SECURITY_HEADERS,
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

/** Var olan başlıkları ezmez (ör. iPhone profil MIME türü). */
export function applySecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(key)) headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
