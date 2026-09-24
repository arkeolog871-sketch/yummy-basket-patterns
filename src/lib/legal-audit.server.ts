import { createHash } from "crypto";
import { getRequestHeader } from "@tanstack/react-start/server";

/** IP düz metin saklanmaz; tuzlu özet ve kısaltılmış tarayıcı bilgisi. */
export async function hashedRequestIp(): Promise<{
  ip_hash: string | null;
  user_agent: string | null;
}> {
  try {
    const ip = getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for") ?? "";
    const salt = process.env["LOVABLE_CRON_SECRET"] ?? "silvan";
    const ua = getRequestHeader("user-agent") ?? null;
    return {
      ip_hash: ip ? createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32) : null,
      user_agent: ua ? ua.slice(0, 200) : null,
    };
  } catch {
    return { ip_hash: null, user_agent: null };
  }
}
