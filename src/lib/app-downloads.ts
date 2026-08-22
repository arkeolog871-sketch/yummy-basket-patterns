export const ANDROID_APK_HREF = "/silvan-cebimde.apk";
export const ANDROID_APK_FILENAME = "silvan-cebimde.apk";
export const IPHONE_PROFILE_HREF = "/silvan-cebimde-iphone.mobileconfig";
export const IPHONE_PROFILE_FILENAME = "silvan-cebimde-iphone.mobileconfig";

export type DownloadPlatform = "ios" | "android" | "other";

export function detectDownloadPlatform(userAgent = ""): DownloadPlatform {
  if (/iphone|ipad|ipod/i.test(userAgent)) return "ios";
  if (/android/i.test(userAgent)) return "android";
  return "other";
}
