import { afterEach, describe, expect, it } from "vitest";
import {
  decideGoogleOAuthHandoff,
  googleOAuthRedirectUriForOrigin,
  isAndroidDevice,
  PRODUCTION_OAUTH_ORIGIN,
} from "@/lib/google-oauth";
import {
  isAllowedGoogleRedirectUri,
  isGoogleOAuthStateConfigured,
  resolveGoogleOAuthStateSecret,
  sealGoogleOAuthStatePayload,
} from "@/lib/google-oauth.server";

const ENV_KEYS = [
  "GOOGLE_OAUTH_STATE_SECRET",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

const previous = new Map<string, string | undefined>();

function snapshotEnv() {
  for (const key of ENV_KEYS) {
    previous.set(key, process.env[key]);
  }
}

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const value = previous.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function clearStateEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}

describe("Google OAuth production redirect pinning", () => {
  it("pins apex and www to the registered production /auth URI", () => {
    expect(googleOAuthRedirectUriForOrigin("https://uygulamamcebimde.online")).toBe(
      `${PRODUCTION_OAUTH_ORIGIN}/auth`,
    );
    expect(googleOAuthRedirectUriForOrigin("https://www.uygulamamcebimde.online/")).toBe(
      `${PRODUCTION_OAUTH_ORIGIN}/auth`,
    );
  });

  it("keeps preview and localhost on same-origin /auth", () => {
    expect(googleOAuthRedirectUriForOrigin("http://localhost:5173")).toBe(
      "http://localhost:5173/auth",
    );
    expect(googleOAuthRedirectUriForOrigin("https://preview.lovable.app")).toBe(
      "https://preview.lovable.app/auth",
    );
  });
});

describe("Google OAuth state secret fail-closed", () => {
  snapshotEnv();
  afterEach(restoreEnv);

  it("does not use a hardcoded fallback secret", () => {
    clearStateEnv();
    expect(resolveGoogleOAuthStateSecret()).toBeNull();
    expect(isGoogleOAuthStateConfigured()).toBe(false);
    expect(() =>
      sealGoogleOAuthStatePayload({
        n: "nonce-value-ok",
        v: "a".repeat(43),
        r: `${PRODUCTION_OAUTH_ORIGIN}/auth`,
        t: Date.now(),
      }),
    ).toThrow(/yapılandırılmadı/);
  });

  it("does not derive the OAuth state key from the service-role key", () => {
    clearStateEnv();
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = "role-key-for-tests";
    expect(resolveGoogleOAuthStateSecret()).toBeNull();
    expect(isGoogleOAuthStateConfigured()).toBe(false);
  });

  it("derives the state key from GOOGLE_OAUTH_CLIENT_SECRET when dedicated secret is absent", () => {
    clearStateEnv();
    process.env["GOOGLE_OAUTH_CLIENT_SECRET"] = "client-secret-for-tests";
    expect(isGoogleOAuthStateConfigured()).toBe(true);
    const state = sealGoogleOAuthStatePayload({
      n: "nonce-value-ok",
      v: "a".repeat(43),
      r: `${PRODUCTION_OAUTH_ORIGIN}/auth`,
      t: Date.now(),
    });
    expect(state.startsWith("sc1.")).toBe(true);
  });
});

describe("Google OAuth redirect allowlist", () => {
  it("allows production apex and www /auth only as exact paths", () => {
    expect(isAllowedGoogleRedirectUri("https://uygulamamcebimde.online/auth")).toBe(true);
    expect(isAllowedGoogleRedirectUri("https://www.uygulamamcebimde.online/auth")).toBe(true);
    expect(isAllowedGoogleRedirectUri("https://uygulamamcebimde.online/auth?next=/admin")).toBe(
      false,
    );
    expect(isAllowedGoogleRedirectUri("https://evil.example/auth")).toBe(false);
  });
});

describe("Google OAuth Android handoff decision", () => {
  const IPHONE_SAFARI =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
  const IPHONE_CHROME =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.0.0 Mobile/15E148 Safari/604.1";
  const ANDROID_CHROME =
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";

  it("never hands off on iPhone Safari, even without a stored PKCE record", () => {
    expect(isAndroidDevice(IPHONE_SAFARI)).toBe(false);
    expect(
      decideGoogleOAuthHandoff({
        userAgent: IPHONE_SAFARI,
        hasNativeBridge: false,
        hasStoredPkce: false,
        isCallback: true,
      }),
    ).toBe(false);
  });

  it("never hands off on iPhone Chrome", () => {
    expect(isAndroidDevice(IPHONE_CHROME)).toBe(false);
    expect(
      decideGoogleOAuthHandoff({
        userAgent: IPHONE_CHROME,
        hasNativeBridge: false,
        hasStoredPkce: true,
        isCallback: true,
      }),
    ).toBe(false);
  });

  it("completes locally on normal Android web logins started in this browser", () => {
    expect(
      decideGoogleOAuthHandoff({
        userAgent: ANDROID_CHROME,
        hasNativeBridge: false,
        hasStoredPkce: true,
        isCallback: true,
      }),
    ).toBe(false);
  });

  it("hands off orphaned Android browser tabs that did not start the flow", () => {
    expect(
      decideGoogleOAuthHandoff({
        userAgent: ANDROID_CHROME,
        hasNativeBridge: false,
        hasStoredPkce: false,
        isCallback: true,
      }),
    ).toBe(true);
  });

  it("never hands off inside the native app shell or outside a callback", () => {
    expect(
      decideGoogleOAuthHandoff({
        userAgent: ANDROID_CHROME,
        hasNativeBridge: true,
        hasStoredPkce: false,
        isCallback: true,
      }),
    ).toBe(false);
    expect(
      decideGoogleOAuthHandoff({
        userAgent: ANDROID_CHROME,
        hasNativeBridge: false,
        hasStoredPkce: false,
        isCallback: false,
      }),
    ).toBe(false);
  });
});
