import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const sealSchema = z.object({
  nonce: z.string().min(8).max(128),
  verifier: z.string().min(43).max(128),
  redirectUri: z.string().url().max(500),
});

const exchangeSchema = z.object({
  code: z.string().min(8).max(2048),
  state: z.string().min(8).max(4096),
  storedNonce: z.string().min(8).max(128).optional(),
  storedVerifier: z.string().min(43).max(128).optional(),
  storedRedirectUri: z.string().url().max(500).optional(),
});

export const sealGoogleOAuthState = createServerFn({ method: "POST" })
  .validator((input: unknown) => sealSchema.parse(input))
  .handler(async ({ data }) => {
    const { enforceSensitiveRateLimit } = await import("./rate-limit.server");
    await enforceSensitiveRateLimit("google-oauth-seal", 20, 10 * 60 * 1000);
    const {
      isAllowedGoogleRedirectUri,
      isGoogleOAuthStateConfigured,
      sealGoogleOAuthStatePayload,
      googleOAuthClientId,
    } = await import("./google-oauth.server");

    if (!googleOAuthClientId()) {
      return {
        ok: false as const,
        error: "Google OAuth istemci kimliği eksik. VITE_GOOGLE_OAUTH_CLIENT_ID tanımlayın.",
      };
    }
    if (!isGoogleOAuthStateConfigured()) {
      return {
        ok: false as const,
        error:
          "Google OAuth durum anahtarı yapılandırılmadı. GOOGLE_OAUTH_STATE_SECRET veya GOOGLE_OAUTH_CLIENT_SECRET tanımlayın.",
      };
    }
    if (!isAllowedGoogleRedirectUri(data.redirectUri)) {
      return { ok: false as const, error: "Google dönüş adresi bu uygulama için kayıtlı değil." };
    }

    return {
      ok: true as const,
      state: sealGoogleOAuthStatePayload({
        n: data.nonce,
        v: data.verifier,
        r: data.redirectUri,
        t: Date.now(),
      }),
    };
  });

export const exchangeGoogleOAuthCode = createServerFn({ method: "POST" })
  .validator((input: unknown) => exchangeSchema.parse(input))
  .handler(async ({ data }) => {
    const { enforceSensitiveRateLimit } = await import("./rate-limit.server");
    await enforceSensitiveRateLimit("google-oauth-exchange", 12, 10 * 60 * 1000);
    const {
      GOOGLE_OAUTH_STATE_PREFIX,
      exchangeGoogleAuthorizationCode,
      unsealGoogleOAuthStatePayload,
    } = await import("./google-oauth.server");

    if (!data.state.startsWith(`${GOOGLE_OAUTH_STATE_PREFIX}.`)) {
      return {
        ok: false as const,
        error: "Durum doğrulama başarısız oldu. Google girişini aynı tarayıcıda yeniden başlatın.",
      };
    }

    let nonce = "";
    let verifier = "";
    let redirectUri = "";
    try {
      const payload = unsealGoogleOAuthStatePayload(data.state);
      nonce = payload.n;
      verifier = payload.v;
      redirectUri = payload.r;
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "Durum doğrulama başarısız oldu.",
      };
    }

    if (data.storedNonce && data.storedNonce !== nonce) {
      return {
        ok: false as const,
        error: "Durum doğrulama başarısız oldu. Saklanan state değeri eşleşmiyor.",
      };
    }

    const exchanged = await exchangeGoogleAuthorizationCode({
      code: data.code,
      redirectUri,
      verifier,
    });
    if (!exchanged.ok) return exchanged;
    return { ok: true as const, idToken: exchanged.idToken, accessToken: exchanged.accessToken };
  });
