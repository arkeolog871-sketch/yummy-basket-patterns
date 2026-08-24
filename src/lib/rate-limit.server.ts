import { getRequestHeader } from "@tanstack/react-start/server";

type RateLimitState = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitState>();
const MAX_BUCKETS = 10_000;

function clientAddress(request?: Request): string {
  // Cloudflare overwrites this header at the edge. The fallback is useful for
  // local development and should only be trusted when the origin is proxy-only.
  return (
    request?.headers.get("cf-connecting-ip") ??
    request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request?.headers.get("x-real-ip") ??
    getRequestHeader("cf-connecting-ip") ??
    getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ??
    getRequestHeader("x-real-ip") ??
    "unknown"
  );
}

function consume(scope: string, limit: number, windowMs: number, request?: Request): boolean {
  const now = Date.now();
  const key = `${scope}:${clientAddress(request)}`;
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) {
      for (const [bucketKey, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(bucketKey);
        if (buckets.size < MAX_BUCKETS) break;
      }
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

export function allowServerFnRequest(request: Request): boolean {
  const method = request.method.toUpperCase();
  return consume(
    method === "POST" ? "server-post" : "server-read",
    method === "POST" ? 90 : 180,
    60_000,
    request,
  );
}

export function enforceSensitiveRateLimit(scope: string, limit: number, windowMs: number): void {
  if (!consume(scope, limit, windowMs)) {
    throw new Error("Çok fazla istek yaptınız. Lütfen kısa süre sonra tekrar deneyin.");
  }
}

export function rateLimitResponse(): Response {
  return new Response("Çok fazla istek yaptınız. Lütfen kısa süre sonra tekrar deneyin.", {
    status: 429,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "retry-after": "60",
    },
  });
}
