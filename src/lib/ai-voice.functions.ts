/**
 * Sesli asistan sunucu fonksiyonları (istemci güvenli modül).
 *
 * Giriş gerektirmez (vitrin sohbeti), bu yüzden hız sınırı uygulanır.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { runServerFn } from "./public-error";

const transcribeSchema = z.object({
  audio: z.string().min(16).max(12_000_000),
  mimeType: z.string().trim().min(3).max(60),
});

const speakSchema = z.object({
  text: z.string().trim().min(1).max(900),
});

export const transcribeAssistantAudio = createServerFn({ method: "POST" })
  .validator((input: unknown) => transcribeSchema.parse(input))
  .handler(async ({ data }) =>
    runServerFn(async () => {
      const { enforceSensitiveRateLimit } = await import("./rate-limit.server");
      await enforceSensitiveRateLimit("ai-assistant-transcribe", 30, 60_000);
      const { transcribeAudio } = await import("./ai-voice.server");
      return { text: await transcribeAudio(data.audio, data.mimeType) };
    }),
  );

export const speakAssistantReply = createServerFn({ method: "POST" })
  .validator((input: unknown) => speakSchema.parse(input))
  .handler(async ({ data }) =>
    runServerFn(async () => {
      const { enforceSensitiveRateLimit } = await import("./rate-limit.server");
      await enforceSensitiveRateLimit("ai-assistant-speak", 40, 60_000);
      const { synthesizeSpeech } = await import("./ai-voice.server");
      return synthesizeSpeech(data.text);
    }),
  );
