/** Sunucu ve istemcide ortak: teknik/HTTPError metnini kullanıcıya gösterilebilir mesaja çevirir. */

const FALLBACK = "İşlem şu anda tamamlanamadı. Lütfen tekrar deneyin.";

export function toPublicErrorMessage(error: unknown, fallback = FALLBACK): string {
  if (error == null) return fallback;

  if (typeof error === "string") {
    return sanitizeMessage(error, fallback);
  }

  if (typeof error === "object") {
    const named = error as { name?: unknown; message?: unknown; issues?: { message?: string }[] };
    if (named.name === "ZodError") {
      const first = named.issues?.[0]?.message?.trim();
      if (first) return first;
      return "Girdiğiniz bilgiler geçersiz.";
    }
    if (typeof named.message === "string" && named.message.trim()) {
      return sanitizeMessage(named.message, fallback);
    }
  }

  return fallback;
}

function sanitizeMessage(message: string, fallback: string): string {
  const text = message.trim();
  if (!text) return fallback;
  if (
    text === "HTTPError" ||
    /"unhandled"\s*:\s*true/.test(text) ||
    (/unhandled/i.test(text) && /HTTPError/i.test(text))
  ) {
    return fallback;
  }
  if (/^Unauthorized/i.test(text)) {
    return "Oturumunuz geçersiz veya süresi doldu. Lütfen yeniden giriş yapın.";
  }
  if (/^Forbidden:\s*/i.test(text)) {
    const rest = text.replace(/^Forbidden:\s*/i, "").trim();
    return rest
      ? sanitizeMessage(rest, "Bu işlem için yetkiniz yok.")
      : "Bu işlem için yetkiniz yok.";
  }
  if (/^Forbidden$/i.test(text)) {
    return "Bu işlem için yetkiniz yok.";
  }
  if (
    /permission denied|PGRST|JWT|column|relation|violates|supabase|stack|ECONN|fetch failed|nosuchbucket|bucket not found|service[_-]?role|LOVABLE_API_KEY|GOOGLE_OAUTH_CLIENT_SECRET|SUPABASE_SERVICE_ROLE|Bearer\s+eyJ|(?:sk|pk)_live/i.test(
      text,
    )
  ) {
    return fallback;
  }
  if (text.startsWith("<!doctype") || text.startsWith("<html")) {
    return fallback;
  }
  if (text.length > 220 || text.includes("\n")) return fallback;
  return text;
}

export function isServerFnRequest(request: Request): boolean {
  if (request.headers.get("x-tsr-serverFn") === "true") return true;
  try {
    const path = new URL(request.url).pathname;
    return /\/_serverFn(?:\/|$)/.test(path);
  } catch {
    return false;
  }
}

/** İstemcinin `error.message` olarak okuyacağı düz metin yanıtı (HTML/HTTPError değil). */
/** Handler içinde yakalanan hataları kullanıcı mesajına çevirip yeniden fırlatır. */
export async function runServerFn<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw new Error(toPublicErrorMessage(error));
  }
}

export function serverFnErrorResponse(error: unknown): Response {
  return new Response(toPublicErrorMessage(error), {
    status: 422,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
