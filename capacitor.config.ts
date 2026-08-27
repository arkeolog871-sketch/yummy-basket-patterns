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
