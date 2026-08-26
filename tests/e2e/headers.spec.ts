import { expect, test } from "@playwright/test";

test.describe("security headers and probes", () => {
  test("home response is not an open CORS origin", async ({ request }) => {
    const response = await request.get("/", { headers: { Origin: "https://evil.example" } });
    const allow = response.headers()["access-control-allow-origin"];
    expect(allow === "*" || allow === "https://evil.example").toBeFalsy();
  });

  test("assetlinks.json is served as JSON for the production Android package", async ({
    request,
  }) => {
    const response = await request.get("/.well-known/assetlinks.json");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"] ?? "").toMatch(/json/i);
    const body = (await response.json()) as Array<{
      target?: { package_name?: string; sha256_cert_fingerprints?: string[] };
    }>;
    expect(body[0]?.target?.package_name).toBe("online.uygulamamcebimde.app");
    for (const fingerprint of body[0]?.target?.sha256_cert_fingerprints ?? []) {
      expect(fingerprint).toMatch(/^[0-9A-F]{2}(?::[0-9A-F]{2}){31}$/);
    }
  });

  test("sensitive probes are not served as app source", async ({ request }) => {
    const env = await request.get("/.env");
    expect([403, 404]).toContain(env.status());
    const git = await request.get("/.git/config");
    expect([403, 404]).toContain(git.status());
  });
});
