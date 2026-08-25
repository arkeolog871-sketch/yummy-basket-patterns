import { expect, test } from "@playwright/test";

test.describe("security headers and probes", () => {
  test("home response is not an open CORS origin", async ({ request }) => {
    const response = await request.get("/", { headers: { Origin: "https://evil.example" } });
    const allow = response.headers()["access-control-allow-origin"];
    expect(allow === "*" || allow === "https://evil.example").toBeFalsy();
  });

  test("sensitive probes are not served as app source", async ({ request }) => {
    const env = await request.get("/.env");
    expect([403, 404]).toContain(env.status());
    const git = await request.get("/.git/config");
    expect([403, 404]).toContain(git.status());
  });
});
