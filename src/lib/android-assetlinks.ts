/** Android App Links Digital Asset Links statement.
 *
 * Package name matches production (`online.uygulamamcebimde.app`).
 * The fingerprint below is the Google Play App Signing certificate digest
 * shown in Play Console (App integrity → App signing). Play-installed builds
 * are signed with this certificate. Do not invent additional hashes; add an
 * upload/sideload keystore digest only after reading it from that keystore.
 */
export const ANDROID_APP_PACKAGE_NAME = "online.uygulamamcebimde.app";

/** Play App Signing (Google-held) certificate digest. */
export const ANDROID_PLAY_APP_SIGNING_SHA256 =
  "6C:D3:38:83:2F:42:70:FD:C9:B6:65:1C:18:07:89:D7:03:61:DA:61:08:B8:89:8F:26:74:DD:FB:1A:BD:98:24";

export const ANDROID_ASSETLINKS = [
  {
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: ANDROID_APP_PACKAGE_NAME,
      sha256_cert_fingerprints: [ANDROID_PLAY_APP_SIGNING_SHA256] as string[],
    },
  },
];

export function androidAssetlinksJson(): string {
  return `${JSON.stringify(ANDROID_ASSETLINKS, null, 2)}\n`;
}
