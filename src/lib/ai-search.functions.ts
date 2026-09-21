/**
 * Akıllı arama — sunucu fonksiyonu (istemci güvenli modül).
 *
 * Giriş gerektirmez: ana sayfa aramasını herkes kullanır. Bu yüzden istek
 * başına hız sınırı uygulanır; yapay zekâ çağrısı başarısız olursa hata
 * fırlatmak yerine `null` niyet döner ve istemci normal aramaya devam eder.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  query: z.string().trim().min(2).max(120),
  sectors: z
    .array(
      z.object({
        slug: z.string().trim().min(1).max(40),
        label: z.string().trim().min(1).max(60),
      }),
    )
    .max(40),
});

export const interpretSmartSearch = createServerFn({ method: "POST" })
  .validator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const { enforceSensitiveRateLimit } = await import("./rate-limit.server");
    try {
      await enforceSensitiveRateLimit("ai-smart-search", 30, 60_000);
    } catch {
      return { intent: null };
    }

    const { interpretSearchIntent } = await import("./ai-search.server");
    try {
      const intent = await interpretSearchIntent(data.query, data.sectors);
      return { intent };
    } catch (error) {
      console.error("[ai-search] başarısız", error instanceof Error ? error.message : error);
      return { intent: null };
    }
  });
