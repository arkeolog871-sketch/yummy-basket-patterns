import { getPublicSupabaseEnv } from "@/lib/public-env";

/** Android APK indirme adresi. `?v=` eki derlemede dosya/sürüme göre otomatik yenilenir. */
const env = getPublicSupabaseEnv();
export const APK_VERSION = env.VITE_APK_VERSION || "1";
export const APK_URL = `/silvan-cebimde.apk?v=${encodeURIComponent(env.VITE_APK_REV || APK_VERSION)}`;
export const APK_DOWNLOAD = "silvan-cebimde.apk";
