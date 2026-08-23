/** Uygulama güvenlik duvarı: tarama isteklerini keser, yanıt başlıklarını sıkılaştırır.
 * Kullanıcı akışını veya sayfa davranışını değiştirmez. */

export const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Permitted-Cross-Domain-Policies": "none",
  "Permissions-Policy": "camera=(), microphone=(), payment=(), usb=(), interest-cohort=()",
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  "X-DNS-Prefetch-Control": "off",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
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
