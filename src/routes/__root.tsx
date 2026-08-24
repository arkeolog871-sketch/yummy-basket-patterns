import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { AuthProvider } from "@/hooks/useAuth";
import { CartProvider } from "@/hooks/useCart";
import { SiteSettingsProvider } from "@/hooks/useSiteSettings";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { IosHomeScreenGuide } from "@/components/iphone/IosHomeScreenGuide";
import { Toaster } from "@/components/ui/sonner";
import { AppRealtimeBridge } from "@/hooks/useAppRealtime";
import { ErrorCollector } from "@/components/system/ErrorCollector";
import { AppErrorBoundary } from "@/components/system/AppErrorBoundary";
import { publicEnvInlineScript } from "@/lib/public-env";
import { TextPrefsProvider } from "@/hooks/useTextPrefs";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Sayfa bulunamadı</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Aradığınız sayfa yok veya taşınmış olabilir.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ana sayfaya dön
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Sayfa yüklenemedi</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Bir şeyler ters gitti. Sayfayı yenileyebilir veya ana sayfaya dönebilirsiniz.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tekrar dene
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Ana sayfaya dön
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "SİLVAN CEBİMDE — Yemek siparişi" },
      {
        name: "description",
        content: "Mahallenin en iyi ustalarından sıcak yemekler, dakikalar içinde kapınızda.",
      },
      { name: "theme-color", content: "#c8341f" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Cebimde" },
      { property: "og:title", content: "SİLVAN CEBİMDE — Yemek siparişi" },
      {
        property: "og:description",
        content: "Mahallenin en iyi ustalarından sıcak yemekler, dakikalar içinde kapınızda.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "preconnect", href: "https://maps.googleapis.com" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="tr">
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: publicEnvInlineScript() }}
          suppressHydrationWarning
        />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function AppChrome() {
  const [framed, setFramed] = useState(false);

  useEffect(() => {
    setFramed(window.self !== window.top);
  }, []);

  return (
    <div className="flex min-h-screen flex-col" data-app-frame={framed ? "true" : undefined}>
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      {framed ? null : <Footer />}
      {framed ? null : <IosHomeScreenGuide />}
    </div>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const standaloneChrome =
    pathname.startsWith("/kurucu") ||
    pathname === "/sifre-sifirlama" ||
    pathname === "/android" ||
    pathname === "/iphone";

  useEffect(() => {
    try {
      const { data } = supabase.auth.onAuthStateChange((event) => {
        if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
        router.invalidate();
        if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
      });
      return () => data.subscription.unsubscribe();
    } catch (error) {
      console.error("[auth-bridge]", error);
      return undefined;
    }
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <AppErrorBoundary>
        <TextPrefsProvider>
          <AuthProvider>
            <SiteSettingsProvider>
              <CartProvider>
                <AppErrorBoundary>
                  {standaloneChrome ? (
                    <div className="min-h-screen">
                      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
                      <Outlet />
                    </div>
                  ) : (
                    <AppChrome />
                  )}
                </AppErrorBoundary>
                <AppRealtimeBridge />
                <ErrorCollector />
                <Toaster />
              </CartProvider>
            </SiteSettingsProvider>
          </AuthProvider>
        </TextPrefsProvider>
      </AppErrorBoundary>
    </QueryClientProvider>
  );
}
