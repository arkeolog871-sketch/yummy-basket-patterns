import { createHash } from "node:crypto";
import { getRequestHeader } from "@tanstack/react-start/server";
import { trustedClientAddress } from "@/lib/trusted-ip";
import { isMissingRpcError } from "@/lib/rpc-fallback";

type RateLimitState = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitState>();
const MAX_BUCKETS = 10_000;

function clientAddress(request?: Request): string {
  return trustedClientAddress((name) => request?.headers.get(name) ?? getRequestHeader(name));
}

function consumeMemory(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
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

function consume(scope: string, limit: number, windowMs: number, request?: Request): boolean {
  const key = `${scope}:${clientAddress(request)}`;
  return consumeMemory(key, limit, windowMs);
}

function hashBucketKey(scope: string, request?: Request): string {
  return createHash("sha256")
    .update(`${scope}:${clientAddress(request)}`)
    .digest("hex");
}

async function consumeDistributed(
  scope: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const bucketKey = hashBucketKey(scope);
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("consume_request_rate_limit", {
      p_bucket_key: bucketKey,
      p_limit: limit,
      p_window_seconds: Math.max(1, Math.ceil(windowMs / 1000)),
      p_now: new Date().toISOString(),
    });
    if (error) {
      if (!isMissingRpcError(error)) {
        console.error("[rate-limit] rpc failed", { message: error.message });
      }
      return consumeMemory(bucketKey, limit, windowMs);
    }
    return data === true;
  } catch {
    return consumeMemory(bucketKey, limit, windowMs);
  }
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

/** OTP/login/order: Postgres RPC varsa tüm instance'lar paylaşır; yoksa bellek yedeği. */
export async function enforceSensitiveRateLimit(
  scope: string,
  limit: number,
  windowMs: number,
): Promise<void> {
  const allowed = await consumeDistributed(scope, limit, windowMs);
  if (!allowed) {
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
