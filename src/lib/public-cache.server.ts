/** Kısa ömürlü bellek önbelleği + singleflight.
 * 10 bin eşzamanlı anonim GET'in aynı SSR/Supabase işini binlerce kez çalıştırmasını önler.
 * Oturum açmış kullanıcılar, mutasyonlar ve özel sayfalar bu yola girmez. */

const CATALOG_TTL_MS = 8_000;
const HTML_TTL_MS = 6_000;
const MAX_HTML_ENTRIES = 200;
const MAX_CATALOG_ENTRIES = 400;
const MAX_SSR_INFLIGHT = 48;
const MAX_SSR_WAITERS = 2_000;

type CacheEntry<T> = { value: T; expiresAt: number };

const catalogCache = new Map<string, CacheEntry<unknown>>();
const catalogInflight = new Map<string, Promise<unknown>>();

export type CachedHtml = {
  status: number;
  statusText: string;
  headers: [string, string][];
  body: Uint8Array;
};

const htmlCache = new Map<string, CacheEntry<CachedHtml>>();
const htmlInflight = new Map<string, Promise<CachedHtml>>();

const PRIVATE_PATH =
  /^\/(?:odeme|siparis(?:lerim)?|adreslerim|kurucu(?:-giris)?|vendor|admin|lovable|_serverFn|api)(?:\/|$)/i;

const AUTH_COOKIE =
  /(?:^|;\s*)(?:sb-[^=;\s]+-auth-token(?:\.\d+)?|sb-[^=;\s]+-auth-token-code-verifier)=/i;

function lruGet<T>(store: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (hit.expiresAt <= Date.now()) {
    store.delete(key);
    return undefined;
  }
  store.delete(key);
  store.set(key, hit);
  return hit.value;
}

function lruSet<T>(store: Map<string, CacheEntry<T>>, key: string, value: T, ttlMs: number, max: number) {
  if (store.has(key)) store.delete(key);
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  while (store.size > max) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

export async function cachedPublicQuery<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = lruGet(catalogCache, key);
  if (hit !== undefined) return hit as T;

  const pending = catalogInflight.get(key);
  if (pending) return pending as Promise<T>;

  const request = load()
    .then((value) => {
      lruSet(catalogCache, key, value, CATALOG_TTL_MS, MAX_CATALOG_ENTRIES);
      return value;
    })
    .finally(() => {
      catalogInflight.delete(key);
    });

  catalogInflight.set(key, request);
  return request;
}

export function hasAuthCookie(request: Request): boolean {
  const cookie = request.headers.get("cookie") ?? "";
  if (!cookie) return false;
  if (AUTH_COOKIE.test(cookie)) return true;
  if (/(?:^|;\s*)(?:authorization|access-token)=/i.test(cookie)) return true;
  return false;
}

export function isCacheablePublicGet(request: Request): boolean {
  if (request.method.toUpperCase() !== "GET" && request.method.toUpperCase() !== "HEAD") {
    return false;
  }
  if (request.headers.has("authorization") || request.headers.has("range")) return false;
  if (hasAuthCookie(request)) return false;

  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return false;
  }

  if (url.searchParams.has("_serverFn")) return false;
  if (PRIVATE_PATH.test(url.pathname)) return false;
  return true;
}

export function publicHtmlCacheKey(request: Request): string {
  const url = new URL(request.url);
  return `${request.method.toUpperCase()} ${url.pathname}${url.search}`;
}

function canStoreHtml(snapshot: CachedHtml): boolean {
  if (snapshot.status >= 500) return false;
  const headers = new Headers(snapshot.headers);
  if (headers.has("set-cookie")) return false;
  return true;
}

export function replayCachedHtml(snapshot: CachedHtml): Response {
  return new Response(snapshot.body.slice(), {
    status: snapshot.status,
    statusText: snapshot.statusText,
    headers: new Headers(snapshot.headers),
  });
}

async function snapshotResponse(response: Response): Promise<CachedHtml> {
  const body = new Uint8Array(await response.arrayBuffer());
  return {
    status: response.status,
    statusText: response.statusText,
    headers: [...response.headers.entries()],
    body,
  };
}

let ssrActive = 0;
const ssrWaiters: Array<() => void> = [];

export class SsrBusyError extends Error {
  constructor() {
    super("Sunucu yoğun. Lütfen birkaç saniye sonra yeniden deneyin.");
    this.name = "SsrBusyError";
  }
}

async function withSsrSlot<T>(work: () => Promise<T>): Promise<T> {
  if (ssrActive >= MAX_SSR_INFLIGHT) {
    if (ssrWaiters.length >= MAX_SSR_WAITERS) throw new SsrBusyError();
    await new Promise<void>((resolve) => {
      ssrWaiters.push(resolve);
    });
  }
  ssrActive += 1;
  try {
    return await work();
  } finally {
    ssrActive -= 1;
    ssrWaiters.shift()?.();
  }
}

export async function serveCachedPublicHtml(
  request: Request,
  render: () => Promise<Response>,
): Promise<Response> {
  const key = publicHtmlCacheKey(request);
  const hit = lruGet(htmlCache, key);
  if (hit) return replayCachedHtml(hit);

  const pending = htmlInflight.get(key);
  if (pending) return replayCachedHtml(await pending);

  const load = (async () => {
    try {
      const response = await withSsrSlot(render);
      const snapshot = await snapshotResponse(response);
      if (canStoreHtml(snapshot)) {
        lruSet(htmlCache, key, snapshot, HTML_TTL_MS, MAX_HTML_ENTRIES);
      }
      return snapshot;
    } finally {
      htmlInflight.delete(key);
    }
  })();

  htmlInflight.set(key, load);
  return replayCachedHtml(await load);
}
