import { afterEach, describe, expect, it } from "vitest";
import { googleOAuthRedirectUriForOrigin, PRODUCTION_OAUTH_ORIGIN } from "@/lib/google-oauth";
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
