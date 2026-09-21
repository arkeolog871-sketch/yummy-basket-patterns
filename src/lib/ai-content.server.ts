/**
 * Ürün içeriği üretimi (açıklama + görsel) — yalnızca sunucu tarafı.
 *
 * Üretilen metin/görsel doğrudan kaydedilmez: satıcı panelde görür, isterse
 * düzenler ve kaydet butonuna basar.
 */
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { createLovableAiGatewayRunIdFetch } from "./ai-gateway.server";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";

function requireKey(): string {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("Yapay zekâ yapılandırması eksik.");
  return key;
}

/** Ürün için 1-2 cümlelik Türkçe satış açıklaması üretir. */
export async function generateProductDescription(input: {
  name: string;
  categoryName?: string | null;
  businessName?: string | null;
}): Promise<string> {
  const key = requireKey();
  const runIdFetch = createLovableAiGatewayRunIdFetch();
  const lovable = createOpenAI({
    baseURL: GATEWAY_URL,
    apiKey: key,
    headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  const details = [
    `Ürün adı: ${input.name}`,
    input.categoryName ? `Kategori: ${input.categoryName}` : null,
    input.businessName ? `İşletme: ${input.businessName}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const result = streamText({
    model: lovable.responses("openai/gpt-6-astra"),
    system: [
      "Yerel bir sipariş uygulaması için ürün açıklaması yazıyorsun.",
      "Türkçe yaz. En fazla 2 kısa cümle, toplam 200 karakteri geçme.",
      "Fiyat, indirim, kampanya, teslimat süresi veya uydurma içerik (gluten değeri, ödül, menşe) YAZMA.",
      "Sadece düz metin döndür; başlık, tırnak veya madde işareti kullanma.",
    ].join(" "),
    prompt: details,
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });

  const text = (await result.text).trim().replace(/^["'“”]+|["'“”]+$/g, "");
  if (!text) throw new Error("Açıklama üretilemedi. Lütfen tekrar deneyin.");
  return text.slice(0, 300);
}

/** Ürün için tanıtım görseli üretir; base64 PNG döner. */
export async function generateProductImage(input: {
  name: string;
  categoryName?: string | null;
}): Promise<{ base64: string; contentType: string }> {
  const key = requireKey();
  const subject = input.categoryName ? `${input.name} (${input.categoryName})` : input.name;

  const response = await fetch(`${GATEWAY_URL}/images/generations`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "openai/gpt-image-2.5-sunburst",
      prompt: [
        `Ürün tanıtım fotoğrafı: ${subject}.`,
        "Tek ürün ortada, sade açık renkli zemin, doğal yumuşak ışık,",
        "yukarıdan hafif açılı çekim, üzerinde yazı veya logo yok, gerçekçi ve iştah açıcı.",
      ].join(" "),
      size: "1024x1024",
      n: 1,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    if (response.status === 402) {
      throw new Error("Yapay zekâ kredisi tükendi. Lütfen kredi yükleyin.");
    }
    if (response.status === 429) {
      throw new Error("Şu an çok yoğunluk var. Biraz sonra tekrar deneyin.");
    }
    throw new Error(`Görsel üretilemedi (${response.status}). ${detail.slice(0, 160)}`);
  }

  const payload = (await response.json()) as {
    data?: { b64_json?: string; url?: string }[];
  };
  const first = payload.data?.[0];
  if (first?.b64_json) return { base64: first.b64_json, contentType: "image/png" };

  if (first?.url) {
    const image = await fetch(first.url);
    if (!image.ok) throw new Error("Görsel indirilemedi. Lütfen tekrar deneyin.");
    const buffer = new Uint8Array(await image.arrayBuffer());
    let binary = "";
    for (const byte of buffer) binary += String.fromCharCode(byte);
    return {
      base64: btoa(binary),
      contentType: image.headers.get("content-type") ?? "image/png",
    };
  }

  throw new Error("Görsel üretilemedi. Lütfen tekrar deneyin.");
}
