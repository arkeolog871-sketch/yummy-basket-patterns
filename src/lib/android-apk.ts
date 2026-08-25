/** Android APK indirme adresi. `?v=` eki derlemede dosya/sürüme göre otomatik yenilenir. */
const VERSION = env("VITE_APK_VERSION") || "1";
const REV = env("VITE_APK_REV") || VERSION;

export const APK_VERSION = VERSION;
export const APK_URL = `/silvan-cebimde.apk?v=${encodeURIComponent(REV)}`;
export const APK_DOWNLOAD = "silvan-cebimde.apk";

function env(name: string): string {
  try {
    const value = import.meta.env[name];
    return typeof value === "string" ? value.trim() : "";
  } catch {
    return "";
  }
}
