export type PublicEnv = {
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_PUBLISHABLE_KEY: string;
  VITE_APK_VERSION: string;
  VITE_APK_REV: string;
  VITE_GOOGLE_OAUTH_CLIENT_ID: string;
  VITE_VAPID_PUBLIC_KEY: string;
};

declare global {
  interface Window {
    __PUBLIC_ENV__?: PublicEnv;
  }
}

function readEnv(name: string): string {
  try {
    const vite = import.meta.env[name];
    if (typeof vite === "string" && vite) return vite;
  } catch {
    /* Lovable üretim demeti import.meta.env anahtarlarını düşürebilir. */
  }
  if (typeof process !== "undefined" && process.env) {
    const value = process.env[name];
    if (typeof value === "string" && value) return value;
  }
  return "";
}

function fromWindow(): PublicEnv | undefined {
  if (typeof globalThis === "undefined") return undefined;
  const bag = (globalThis as { __PUBLIC_ENV__?: PublicEnv }).__PUBLIC_ENV__;
  if (!bag?.VITE_SUPABASE_URL || !bag?.VITE_SUPABASE_PUBLISHABLE_KEY) return undefined;
  return {
    VITE_SUPABASE_URL: bag.VITE_SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: bag.VITE_SUPABASE_PUBLISHABLE_KEY,
    VITE_APK_VERSION: bag.VITE_APK_VERSION || readEnv("VITE_APK_VERSION") || "1",
    VITE_APK_REV: bag.VITE_APK_REV || readEnv("VITE_APK_REV") || bag.VITE_APK_VERSION || "1",
    VITE_GOOGLE_OAUTH_CLIENT_ID:
      bag.VITE_GOOGLE_OAUTH_CLIENT_ID ||
      readEnv("VITE_GOOGLE_OAUTH_CLIENT_ID") ||
      readEnv("GOOGLE_OAUTH_CLIENT_ID"),
    VITE_VAPID_PUBLIC_KEY:
      bag.VITE_VAPID_PUBLIC_KEY || readEnv("VITE_VAPID_PUBLIC_KEY") || readEnv("VAPID_PUBLIC_KEY"),
  };
}

/** Yayınlanabilir anahtarlar. Service role asla buraya girmez. */
export function getPublicSupabaseEnv(): PublicEnv {
  const fromDom = fromWindow();
  if (fromDom) return fromDom;
  const url = readEnv("VITE_SUPABASE_URL") || readEnv("SUPABASE_URL");
  const key =
    readEnv("VITE_SUPABASE_PUBLISHABLE_KEY") ||
    readEnv("VITE_SUPABASE_ANON_KEY") ||
    readEnv("SUPABASE_PUBLISHABLE_KEY") ||
    readEnv("SUPABASE_ANON_KEY");
  const apkVersion = readEnv("VITE_APK_VERSION") || "1";
  return {
    VITE_SUPABASE_URL: url,
    VITE_SUPABASE_PUBLISHABLE_KEY: key,
    VITE_APK_VERSION: apkVersion,
    VITE_APK_REV: readEnv("VITE_APK_REV") || apkVersion,
    VITE_GOOGLE_OAUTH_CLIENT_ID:
      readEnv("VITE_GOOGLE_OAUTH_CLIENT_ID") || readEnv("GOOGLE_OAUTH_CLIENT_ID"),
    VITE_VAPID_PUBLIC_KEY: readEnv("VITE_VAPID_PUBLIC_KEY") || readEnv("VAPID_PUBLIC_KEY"),
  };
}

/**
 * Native kabuğun gönderdiği bildirim token'ını React bağlanmadan önce yakalar.
 *
 * Android tarafı token'ı sayfa yüklenir yüklenmez şu biçimde gönderiyor:
 *
 *   window.__onFcmToken && window.__onFcmToken('<token>')
 *
 * Fonksiyon o an tanımlı değilse `&&` kısa devre yapıyor ve token sessizce
 * kayboluyor -- tek deneme, tekrar yok. React'in bağlanmasını beklemek bu
 * yarışı şansa bırakıyordu. Bu betik belgenin başında çalışıp token'ı bir
 * değişkende tutuyor; FcmTokenBridge bağlandığında oradan alıyor.
 */
export function fcmTokenCatcherInlineScript(): string {
  return "window.__fcmTokenPending=null;window.__onFcmToken=function(t){if(t)window.__fcmTokenPending=t;};";
}

export function publicEnvInlineScript(): string {
  // JSON.stringify `<` karakterini kaçırmaz; bir değer `</script>` içerseydi
  // satır içi blok erken kapanır ve kalanı HTML olarak yorumlanırdı. Değerler
  // operatörün ortam değişkenlerinden geldiği için bugün istismar edilebilir
  // değil, ama enjeksiyonu değere bağlı bırakmamak için kaçırılır.
  const json = JSON.stringify(getPublicSupabaseEnv()).replace(/</g, "\\u003c");
  return `window.__PUBLIC_ENV__=${json};`;
}
