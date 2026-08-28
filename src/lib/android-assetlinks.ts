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
  "52:F0:37:72:53:80:CE:26:86:61:AF:3F:D3:70:FD:D9:27:67:D1:D6:FF:EC:8B:9D:14:85:03:92:FF:81:CE:A3";

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
