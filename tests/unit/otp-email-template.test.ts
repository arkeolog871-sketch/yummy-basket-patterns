import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";
import * as React from "react";
import { SignupEmail } from "@/lib/email-templates/signup";
import { MagicLinkEmail } from "@/lib/email-templates/magic-link";

describe("OTP email templates", () => {
  it("embeds the 6-digit code in the signup mail body", async () => {
    const html = await render(
      React.createElement(SignupEmail, {
        siteName: "SİLVAN CEBİMDE",
        siteUrl: "https://uygulamamcebimde.online",
        recipient: "ada@example.com",
        confirmationUrl: "https://uygulamamcebimde.online",
        token: "042861",
      }),
    );
    expect(html).toContain("042861");
    expect(html).toContain("6 haneli");
    expect(html).not.toContain("0428617");
  });

  it("embeds the login code and does not print empty boxes", async () => {
    const html = await render(
      React.createElement(MagicLinkEmail, {
        siteName: "SİLVAN CEBİMDE",
        confirmationUrl: "https://uygulamamcebimde.online",
        token: "998877",
      }),
    );
    expect(html).toContain("998877");
    const empty = await render(
      React.createElement(MagicLinkEmail, {
        siteName: "SİLVAN CEBİMDE",
        confirmationUrl: "https://uygulamamcebimde.online",
      }),
    );
    expect(empty).not.toMatch(/Doğrulama kodunuz/);
  });
});
