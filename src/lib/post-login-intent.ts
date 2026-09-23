/**
 * Girişten sonra kullanıcının dönmek istediği uygulama içi sayfa.
 *
 * Apple/Google akışı kullanıcıyı her zaman `/auth` adresine geri getiriyor;
 * niyet saklanmazsa giriş başarılı olsa bile kişi ana sayfaya düşüyor ve
 * başlattığı işi (örn. işletme başvurusu) kaybediyor.
 *
 * Yalnızca beyaz listedeki uygulama içi yollara izin verilir: dışarıdan
 * gelen `?redirect=https://…` gibi bir değerle kullanıcıyı başka siteye
 * göndermek (open redirect) mümkün olmasın.
 */
export const POST_LOGIN_INTENT_KEY = "silvan.post-login-intent.v1";

const ALLOWED_PATHS = ["/isletme-basvuru", "/odeme"] as const;

/** Beyaz listedeki bir yol ise normalize edilmiş hâlini, değilse null döner. */
export function sanitizePostLoginPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  // Protokol veya protokole benzer başlangıçlar (`//example.com`) dış adrestir.
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  const path = trimmed.split(/[?#]/)[0] ?? "";
  const match = ALLOWED_PATHS.find((allowed) => path === allowed);
  return match ?? null;
}

export function rememberPostLoginIntent(path: string): void {
  const safe = sanitizePostLoginPath(path);
  if (!safe || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(POST_LOGIN_INTENT_KEY, safe);
  } catch {
    /* gizli sekme */
  }
}

export function readPostLoginIntent(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sanitizePostLoginPath(window.sessionStorage.getItem(POST_LOGIN_INTENT_KEY));
  } catch {
    return null;
  }
}

export function clearPostLoginIntent(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(POST_LOGIN_INTENT_KEY);
  } catch {
    /* gizli sekme */
  }
}

/**
 * Girişten sonra gidilecek yer: sırayla saklanan niyet, OAuth dönüş yolu ve
 * adres çubuğundaki `redirect` parametresi denenir.
 */
export function resolvePostLoginTarget(
  candidates: Array<string | null | undefined>,
): string | null {
  for (const candidate of candidates) {
    const safe = sanitizePostLoginPath(candidate);
    if (safe) return safe;
  }
  return null;
}
