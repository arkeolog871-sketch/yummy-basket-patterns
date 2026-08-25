import { expect, test } from "@playwright/test";

const XSS = `<img src=x onerror=alert(1)><script>alert(1)</script>`;

test.describe("client-side abuse inputs", () => {
  test("search/XSS payload is not executed as HTML", async ({ page }) => {
    const dialogs: string[] = [];
    page.on("dialog", (dialog) => {
      dialogs.push(dialog.message());
      void dialog.dismiss();
    });
    await page.goto("/");
    const search = page.getByRole("searchbox").or(page.locator("input[type=search], input[name=search]"));
    if (await search.first().isVisible().catch(() => false)) {
      await search.first().fill(XSS);
      await search.first().press("Enter");
    }
    await page.goto(`/restoranlar?search=${encodeURIComponent(XSS)}`);
    await expect(page.locator("script", { hasText: "alert(1)" })).toHaveCount(0);
    expect(dialogs).toEqual([]);
    await expect(page.locator("body")).not.toContainText("at Module.");
  });

  test("unknown API paths do not expose stack traces", async ({ request }) => {
    const response = await request.get("/api/public/media/product-images/../secret.png");
    expect([400, 403, 404]).toContain(response.status());
    const body = await response.text();
    expect(body).not.toMatch(/supabaseAdmin|SERVICE_ROLE|stack/i);
  });
});
