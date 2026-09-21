/**
 * Akıllı arama — yalnızca sunucu tarafı.
 *
 * Kullanıcı arama kutusuna "ucuz kahvaltı", "gece açık eczane", "evime pizza
 * getiren yer" gibi serbest cümleler yazıyor. Bu modül cümleyi mevcut arama
 * altyapısının anladığı iki şeye çevirir: bir kategori (sector slug) ve kısa
 * anahtar kelimeler. Yapay zekâ yanıt vermezse çağıran taraf sessizce normal
 * metin aramasına döner — arama ASLA yapay zekâya bağımlı hale gelmez.
 */
import { createOpenAI } from "@ai-sdk/openai";
import { NoObjectGeneratedError, Output, streamText } from "ai";
import { z } from "zod";
import { aiProvider, aiResponsesOptions } from "./ai-provider.server";
import { createLovableAiGatewayRunIdFetch } from "./ai-gateway.server";

const IntentSchema = z.object({
  /** Uygulamadaki kategori slug'ı veya null. */
  sector: z.string().nullable(),
  /** Vitrin aramasında kullanılacak 1-3 kelime; boş olabilir. */
  keywords: z.string().nullable(),
  /** Kullanıcıya gösterilecek tek cümlelik özet. */
  note: z.string().nullable(),
});

export type SearchIntent = {
  sector: string | null;
  keywords: string | null;
  note: string | null;
};

export type SectorOption = { slug: string; label: string };

function systemPrompt(sectors: SectorOption[]): string {
  return [
    "Sen bir yerel pazaryeri uygulamasının arama yardımcısısın.",
    "Kullanıcının Türkçe serbest cümlesini iki şeye çevir:",
    "1) sector: aşağıdaki listedeki slug'lardan EN uygun olanı, uygun yoksa null.",
    "2) keywords: işletme adı/mutfak/ürün aramasında kullanılacak en fazla 3 kelime;",
    "   'ucuz', 'en iyi', 'yakın', 'açık' gibi niyet kelimelerini keywords'e YAZMA.",
    "3) note: kullanıcıya gösterilecek tek kısa cümle (örn. 'Kahvaltı yapılan kafeler arasında arıyoruz.').",
    "Uydurma yapma; emin değilsen null ver. Sadece JSON döndür.",
    `Kategori listesi: ${sectors.map((sector) => `${sector.slug} (${sector.label})`).join(", ")}`,
  ].join(" ");
}

export async function interpretSearchIntent(
  query: string,
  sectors: SectorOption[],
): Promise<SearchIntent | null> {
  // Yapılandırma yoksa akıllı arama sessizce kapanır; düz arama çalışır.
  let provider;
  try {
    provider = aiProvider();
  } catch {
    return null;
  }

  const runIdFetch = createLovableAiGatewayRunIdFetch();
  const lovable = createOpenAI({
    baseURL: provider.baseUrl,
    apiKey: provider.apiKey,
    headers: provider.headers,
    fetch: runIdFetch.fetch,
  });

  const result = streamText({
    model: lovable.responses(provider.models.chat),
    system: systemPrompt(sectors),
    prompt: query,
    output: Output.object({ schema: IntentSchema }),
    providerOptions: aiResponsesOptions(provider),
  });

  try {
    const output = await result.output;
    const allowed = new Set(sectors.map((sector) => sector.slug));
    const sector = output.sector && allowed.has(output.sector.trim()) ? output.sector.trim() : null;
    const keywords = output.keywords?.trim().slice(0, 60) || null;
    const note = output.note?.trim().slice(0, 160) || null;
    if (!sector && !keywords) return null;
    return { sector, keywords, note };
  } catch (error) {
    // Model JSON üretemediyse arama normal metin aramasıyla devam eder.
    if (NoObjectGeneratedError.isInstance(error)) return null;
    console.error("[ai-search]", error instanceof Error ? error.message : error);
    return null;
  }
}
