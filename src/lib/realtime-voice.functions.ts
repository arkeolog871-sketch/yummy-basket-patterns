/**
 * Gerçek zamanlı ses oturumu için sunucu fonksiyonu (istemci güvenli modül).
 *
 * Tarayıcı yalnız kısa ömürlü istemci sırrını alır; kalıcı anahtar sunucuda
 * kalır. Vitrin sohbeti giriş gerektirmediği için hız sınırı uygulanır.
 */
import { createServerFn } from "@tanstack/react-start";
import { runServerFn } from "./public-error";

export const createRealtimeVoiceSession = createServerFn({ method: "POST" }).handler(async () =>
  runServerFn(async () => {
    const { enforceSensitiveRateLimit } = await import("./rate-limit.server");
    await enforceSensitiveRateLimit("ai-assistant-realtime", 20, 60_000);
    const { createRealtimeSecret } = await import("./realtime-voice.server");
    return createRealtimeSecret();
  }),
);
