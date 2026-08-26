/** Android App Links Digital Asset Links statement.
 *
 * Package name matches production (`online.uygulamamcebimde.app`).
 * SHA-256 fingerprints are empty until the operator pastes the real
 * Play App Signing / release keystore digest. Do not invent hashes.
 *
 * MANUEL: RELEASE SHA-256 GEREKLİ
 */
export const ANDROID_APP_PACKAGE_NAME = "online.uygulamamcebimde.app";

export const ANDROID_ASSETLINKS = [
  {
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: ANDROID_APP_PACKAGE_NAME,
      sha256_cert_fingerprints: [] as string[],
    },
  },
];

export function androidAssetlinksJson(): string {
  return `${JSON.stringify(ANDROID_ASSETLINKS, null, 2)}\n`;
}
