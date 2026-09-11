/** Android App Links Digital Asset Links statement.
 *
 * Package name matches production (`online.uygulamamcebimde.app`).
 * The fingerprint below is the Google Play App Signing certificate digest
 * shown in Play Console (App integrity → App signing). Play-installed builds
 * are signed with this certificate. Do not invent additional hashes; add an
 * upload/sideload keystore digest only after reading it from that keystore.
 */
export const ANDROID_APP_PACKAGE_NAME = "online.uygulamamcebimde.app";

/**
 * Play App Signing (Google-held) certificate digest.
 *
 * Tek doğru kaynak: Play Console → Google Play ile korunanlar → Uygulama
 * imzalama → "Digital Asset Links JSON dosyası" kutusunda Google'ın ürettiği
 * snippet. Buraya elle bir değer yazma, o kutudan kopyala. İmzalama anahtarı
 * değiştirilirse (Anahtarı değiştir) bu digest de değişir ve burası
 * güncellenmezse App Links doğrulaması sessizce düşer — o zaman Google OAuth
 * dönüşü uygulamayı açamaz, kullanıcı tarayıcıda kilitli kalır.
 */
export const ANDROID_PLAY_APP_SIGNING_SHA256 =
  "05:A6:AC:8A:62:2D:B8:B1:97:57:01:D3:E7:66:EE:A6:AE:65:B2:95:E5:78:F2:9E:F0:58:D1:7D:56:73:45:48";

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
