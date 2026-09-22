/**
 * Menü fotoğrafından ürün çıkarma — yalnızca sunucu tarafı.
 *
 * İşletme/bölge yöneticisi menü veya fiyat listesi fotoğrafı yükler; yapay
 * zekâ ürün adı, fiyat, kategori ve kısa açıklamayı çıkarır. Sonuç ASLA
 * doğrudan veritabanına yazılmaz: satıcı düzenlenebilir listede görüp
 * onaylar, kayıt ayrı bir sunucu fonksiyonuyla (ai-menu-import.functions.ts
 * → import_menu_items_by_name RPC) olur.
 *
 * Çıktı şeması katı (strict) uyumludur: kökte tek nesne, tüm alanlar
 * zorunlu, isteğe bağlı alanlar `nullable`. Sayı sınırları şemada DEĞİL,
 * istemde ve kodda (kırpma) uygulanır.
 */
import { createOpenAI } from "@ai-sdk/openai";
import { Output, NoObjectGeneratedError, streamText } from "ai";
import { z } from "zod";
import { aiProviderForUse, aiResponsesOptions } from "./ai-provider.server";
import { createLovableAiGatewayRunIdFetch } from "./ai-gateway.server";

export const ExtractedProductSchema = z.object({
  name: z.string(),
  price: z.number().nullable(),
  categoryName: z.string().nullable(),
  description: z.string().nullable(),
});

export type ExtractedProductModel = z.infer<typeof ExtractedProductSchema>;

/** İstemciye giden ürün: model çıktısı + listede kullanılacak sabit anahtar. */
export type ExtractedProduct = ExtractedProductModel & { key: string };

const ExtractionOutputSchema = z.object({
  products: z.array(ExtractedProductSchema),
});

/** Tek istekte kaç fotoğraf okunabilir (istemci zaten 4 ile sınırlar). */
export const MAX_PHOTOS = 4;
/** Bir istekte çıkarılacak en fazla ürün; fazlası kodda kırpılır. */
const MAX_PRODUCTS = 120;

const SYSTEM_PROMPT = [
  "Sen bir menü/fiyat listesi okuma uzmanısın. Verilen fotoğraflardaki yemek,",
  "içecek veya market ürünlerini listeler halinde çıkar.",
  "Kurallar:",
  "- Her ürün için ad, fiyat (TL, sayı), kategori adı ve kısa açıklama ver.",
  "- Fiyat okunamıyorsa veya yazmıyorsa null ver; ASLA tahmin etme.",
  "- Kategori fotoğrafta bölüm başlığı olarak yoksa null ver; uydurma.",
  "- Açıklama yalnızca fotoğrafta yazıyorsa ver, yoksa null ver.",
  "- Aynı ürün birden çok kez görünüyorsa bir kez ver.",
  "- En fazla 120 ürün çıkar. Sadece JSON döndür.",
].join(" ");

function clampProduct(raw: ExtractedProductModel, index: number): ExtractedProduct | null {
  const name = raw.name.trim().slice(0, 80);
  if (!name) return null;
  const price =
    typeof raw.price === "number" && Number.isFinite(raw.price)
      ? Math.round(Math.min(100_000, Math.max(0, raw.price)) * 100) / 100
      : null;
  return {
    key: `p${index}`,
    name,
    // Fiyatsız ürün de listelenir; satıcı listede fiyatı girip öyle kaydeder.
    price,
    categoryName: raw.categoryName?.trim().slice(0, 60) || null,
    description: raw.description?.trim().slice(0, 300) || null,
  };
}

/**
 * Fotoğraflardan ürün listesi çıkarır. Her çağrı akışlı (streaming) yapılır:
 * çıkarma bazen uzun sürebilir; tamponlu çağrı barındırma platformunun
 * ~2 dakikalık sessizlik sınırına takılır ve faturalanan üretim boşa gider.
 */
export async function extractProductsFromImages(images: string[]): Promise<ExtractedProduct[]> {
  // Anahtar yoksa burada açık hatayla durur (bkz. ai-provider.server).
  const provider = await aiProviderForUse();

  const runIdFetch = createLovableAiGatewayRunIdFetch();
  const lovable = createOpenAI({
    baseURL: provider.baseUrl,
    apiKey: provider.apiKey,
    headers: provider.headers,
    fetch: runIdFetch.fetch,
  });

  const result = streamText({
    model: lovable.responses(provider.models.chat),
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user" as const,
        content: [
          {
            type: "text" as const,
            text: "Bu fotoğraflardaki menü/fiyat listesindeki ürünleri çıkar.",
          },
          // AI SDK v7'de görsel parçası "file" olarak gönderilir ("image" deprecated).
          ...images.map((dataUrl) => ({
            type: "file" as const,
            data: dataUrl,
            mediaType: dataUrl.slice(5, dataUrl.indexOf(";")) || "image/png",
          })),
        ],
      },
    ],
    output: Output.object({ schema: ExtractionOutputSchema }),
    providerOptions: aiResponsesOptions(provider),
  });

  try {
    const output = await result.output;
    return (output.products ?? [])
      .slice(0, MAX_PRODUCTS)
      .map((product, index) => clampProduct(product, index))
      .filter((product): product is ExtractedProduct => product !== null);
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      // Modelin ham metninden son bir kurtarma denemesi; olmazsa anlaşılır hata.
      const text = typeof error.text === "string" ? error.text : "";
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          const parsed = ExtractionOutputSchema.parse(JSON.parse(match[0]));
          return (parsed.products ?? [])
            .slice(0, MAX_PRODUCTS)
            .map((product, index) => clampProduct(product, index))
            .filter((product): product is ExtractedProduct => product !== null);
        } catch {
          // kurtarma başarısız — aşağıdaki hata fırlar
        }
      }
      throw new Error(
        "Menü fotoğrafı okunamadı. Daha net ve düz açıdan çekilmiş bir fotoğrafla tekrar deneyin.",
      );
    }
    throw error;
  }
}
