import type { CapacitorConfig } from "@capacitor/cli";

/**
 * iOS native shell. Android stays in android-wrapper (not Capacitor android/).
 * TanStack Start server functions live on production; the WebView loads that origin.
 */
const config: CapacitorConfig = {
  appId: "online.uygulamamcebimde.app",
  appName: "Uygulamam Cebimde",
  webDir: "public",
  server: {
    url: "https://uygulamamcebimde.online",
    androidScheme: "https",
    iosScheme: "https",
  },
  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile",
    scheme: "Uygulamam Cebimde",
  },
};

export default config;
