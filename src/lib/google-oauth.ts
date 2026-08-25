import { createLovableAuth } from "@lovable.dev/cloud-auth-js";
import { supabase } from "@/integrations/supabase/client";

const lovableAuth = createLovableAuth({
  supportedOAuthOrigins: [
    "https://oauth.lovable.app",
    "https://auth.lovable.app",
    "https://lovable.dev",
  ],
});

const IN_APP_BROWSER =
  /FBAN|FBAV|Instagram|Line\/|Twitter|LinkedInApp|MicroMessenger|Snapchat|TikTok|Pinterest|GSA\//i;

export function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return IN_APP_BROWSER.test(navigator.userAgent);
}

/** Google dönüşü aynı kökte kalsın; yol eklemek Lovable yönlendirme listesini bozabilir. */
export function oauthRedirectUri(): string {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

export async function startGoogleOAuth(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof window === "undefined") {
    return { ok: false, error: "Google girişi yalnızca tarayıcıda çalışır." };
  }

  try {
    sessionStorage.setItem("silvan-oauth-return", `${window.location.pathname}${window.location.search}`);
  } catch {
    /* private mode */
  }

  const result = await lovableAuth.signInWithOAuth("google", {
    redirect_uri: oauthRedirectUri(),
  });

  if (result.redirected) return { ok: true };
  if (result.error) {
    return { ok: false, error: humanizeOAuthError(result.error.message) };
  }
  if (result.tokens) {
    const { error } = await supabase.auth.setSession(result.tokens);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }
  return { ok: false, error: "Google girişi tamamlanamadı." };
}

export function humanizeOAuthError(message: string): string {
  const text = message.toLowerCase();
  if (text.includes("invalid_request") || text.includes("state") || text.includes("csrf")) {
    return "Google yetkilendirmesi tarayıcı çerezi yüzünden kesildi. Chrome veya Safari’de tekrar deneyin; uygulama içi tarayıcı (Instagram, Facebook) kullanmayın.";
  }
  if (text.includes("popup")) {
    return "Açılır pencere engellendi. Google girişini aynı sekmede yeniden deneyin.";
  }
  if (text.includes("cancelled") || text.includes("canceled")) {
    return "Google girişi iptal edildi.";
  }
  return message || "Google girişi başlatılamadı.";
}
