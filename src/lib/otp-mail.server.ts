import * as React from "react";
import { render } from "@react-email/render";
import { sendLovableEmail } from "@lovable.dev/email-js";
import { MagicLinkEmail } from "@/lib/email-templates/magic-link";
import { SignupEmail } from "@/lib/email-templates/signup";
import type { OtpEmailPurpose } from "@/lib/otp";

const SITE_NAME = "SİLVAN CEBİMDE";
const SENDER_DOMAIN = "notify.uygulamamcebimde.online";
const ROOT_DOMAIN = "uygulamamcebimde.online";
const SITE_URL = `https://${ROOT_DOMAIN}`;

/** 6 haneli doğrulama kodunu mevcut markalı şablonla gönderir. Kod loglanmaz. */
export async function sendSixDigitOtpEmail(input: {
  to: string;
  code: string;
  purpose?: OtpEmailPurpose;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) {
    console.error("[otp] LOVABLE_API_KEY eksik, doğrulama kodu gönderilemedi");
    return {
      ok: false,
      error: "Doğrulama kodu şu anda gönderilemedi. Lütfen birkaç saniye sonra tekrar deneyin.",
    };
  }

  const purpose = input.purpose ?? "login";
  const element =
    purpose === "signup"
      ? React.createElement(SignupEmail, {
          siteName: SITE_NAME,
          siteUrl: SITE_URL,
          recipient: input.to,
          confirmationUrl: SITE_URL,
          token: input.code,
        })
      : React.createElement(MagicLinkEmail, {
          siteName: SITE_NAME,
          confirmationUrl: SITE_URL,
          token: input.code,
        });

  const html = await render(element);
  const text = await render(element, { plainText: true });
  const subject =
    purpose === "signup" ? `${SITE_NAME} hesabınızı doğrulayın` : `${SITE_NAME} giriş kodunuz`;
  const domains = [SENDER_DOMAIN, ROOT_DOMAIN];
  let lastMessage = "E-posta gönderim servisine ulaşılamadı, kod gönderilemedi. Lütfen tekrar deneyin.";

  for (const domain of domains) {
    try {
      const result = await sendLovableEmail(
        {
          to: input.to,
          from: `${SITE_NAME} <noreply@${domain}>`,
          sender_domain: domain,
          subject,
          html,
          text,
          purpose: "transactional",
          idempotency_key: `otp-${purpose}-${domain}-${input.to.trim().toLowerCase()}-${Math.floor(Date.now() / 1000)}`,
        },
        { apiKey, sendUrl: process.env["LOVABLE_SEND_URL"] },
      );
      if (result.success) return { ok: true };
      lastMessage = "Doğrulama kodu şu anda gönderilemedi. Lütfen birkaç saniye sonra tekrar deneyin.";
    } catch (error) {
      lastMessage = error instanceof Error ? error.message : lastMessage;
      console.error("[otp] doğrulama kodu e-postası gönderilemedi", {
        senderDomain: domain,
        message: lastMessage,
      });
    }
  }

  const hookFailure = /hook|send|email|deliver/i.test(lastMessage);
  return {
    ok: false,
    error: hookFailure
      ? "E-posta gönderim servisine ulaşılamadı, kod gönderilemedi. Lütfen tekrar deneyin."
      : "Doğrulama kodu şu anda gönderilemedi. Lütfen birkaç saniye sonra tekrar deneyin.",
  };
}
