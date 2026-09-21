/**
 * Sipariş asistanı — sunucu fonksiyonu (istemci güvenli modül).
 *
 * Giriş gerektirmez (vitrin sohbeti), bu yüzden hız sınırı uygulanır.
 * Asistanın veritabanına yazma yetkisi yoktur: araçları yalnızca vitrin
 * istemcisiyle okuma yapar, sipariş kullanıcının onayıyla mevcut ödeme
 * akışında oluşur.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { runServerFn } from "./public-error";

const schema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(1500),
      }),
    )
    .min(1)
    .max(20),
  instruction: z.string().trim().max(600).nullish(),
});

export const askOrderAssistant = createServerFn({ method: "POST" })
  .validator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) =>
    runServerFn(async () => {
      const { enforceSensitiveRateLimit } = await import("./rate-limit.server");
      await enforceSensitiveRateLimit("ai-order-assistant", 20, 60_000);
      const { runAssistant } = await import("./ai-assistant.server");
      return runAssistant(data.messages, data.instruction ?? null);
    }),
  );
