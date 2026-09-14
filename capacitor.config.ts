import type { CapacitorConfig } from "@capacitor/cli";

/**
 * iOS native shell. Android stays in android-wrapper (not Capacitor android/).
 * TanStack Start server functions live on production; the WebView loads that origin.
 */
const config: CapacitorConfig = {
  appId: "online.uygulamamcebimde.app",
  appName: "Silvan Cebimde",
  webDir: "public",
  server: {
    url: "https://uygulamamcebimde.online",
    // Uzaktaki adres yüklenemezse (kopuk bağlantı, DNS, inceleme sırasındaki
    // kısıtlı ağ) WKWebView boş beyaz bir ekran gösteriyor ve uygulama bozuk
    // görünüyor. Bu yerel sayfa sebebi söylüyor ve tekrar deneme veriyor.
    errorPath: "baglanti-hatasi.html",
  },
  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile",
    // Xcode target/scheme name (not the display name).
    scheme: "App",
    // AppDelegate owns UNUserNotificationCenter for Firebase Messaging.
    handleApplicationNotifications: false,
  },
};

export default config;
