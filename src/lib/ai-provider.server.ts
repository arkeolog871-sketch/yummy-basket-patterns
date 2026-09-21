/**
 * Yapay zekâ sağlayıcısının tek karar noktası — yalnızca sunucu tarafı.
 *
 * NEDEN: sağlayıcı beş ayrı dosyada tekrar tekrar kuruluyordu (asistan, ses,
 * arama, içerik üretimi, menü okuma). Sağlayıcı değiştirmek beş dosyaya
 * dokunmak, birini unutmak ise faturanın bir kısmının eski yerden çıkmaya
 * devam etmesi demekti. Karar buraya toplandı.
 *
 * SEÇİM KURALI (üretim): BİRİNCİL sağlayıcı doğrudan OpenAI'dir
 * (`OPENAI_API_KEY`). Lovable geçidi yalnızca
 * `AI_ALLOW_LOVABLE_FALLBACK=true` verildiğinde yedek olarak devreye girer;
 * varsayılan olarak KAPALIDIR. Böylece anahtar yanlış yazıldığında harcama
 * sessizce Lovable kredilerine kaymaz, açık bir yapılandırma hatası alınır.
 *
 * DİKKAT: LOVABLE_API_KEY yalnızca yapay zekâ için değil, e-POSTA gönderimi
 * için de kullanılıyor (otp-mail.server.ts, order-vendor-alert.server.ts).
 * OpenAI'ye geçmek o bağımlılığı kaldırmaz.
 */

/** Model adları sağlayıcıya göre değişiyor; geçitte "openai/" öneki var. */
export interface AiModels {
  chat: string;
  transcribe: string;
  speech: string;
  image: string;
}

export interface AiProviderConfig {
  name: "openai" | "lovable";
  apiKey: string;
  /** Vercel AI SDK'ya verilecek taban adres; OpenAI'de varsayılan kullanılır. */
  baseUrl: string;
  /** Kimlik doğrulama başlıkları. */
  headers: Record<string, string>;
  models: AiModels;
}

const LOVABLE_MODELS: AiModels = {
  chat: "openai/gpt-6-astra",
  transcribe: "google/gemini-3.5-transcribe",
  speech: "openai/gpt-4o-mini-tts",
  image: "openai/gpt-image-2.5-sunburst",
};

/**
 * OpenAI'de model adları öneksiz. Sohbet varsayılanı `gpt-5.6-luna`:
 * maliyeti gpt-6-astra'nın onda birinden az, uygulamadaki işler (sohbet,
 * arama niyeti, menü okuma, kısa metin) için yeterli. Ses yazıya çevirme
 * Google modeliydi; OpenAI karşılığı gpt-4o-transcribe. Görsel üretiminde
 * Lovable'a özgü ad yerine OpenAI'nin kendi modeli (gpt-image-1) kullanılır.
 */
const OPENAI_MODELS: AiModels = {
  chat: "gpt-5.6-luna",
  transcribe: "gpt-4o-transcribe",
  speech: "gpt-4o-mini-tts",
  image: "gpt-image-1",
};

const LOVABLE_BASE_URL = "https://ai.gateway.lovable.dev/v1";
const OPENAI_BASE_URL = "https://api.openai.com/v1";

type Env = Record<string, string | undefined>;

function trimmed(env: Env, name: string): string | undefined {
  const value = env[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * Model adları ortamdan tek tek ezilebiliyor. Sebebi maliyet: gpt-6-astra
 * 1M token için $10/$50, gpt-5.6-luna $0.20/$1.20. Sohbeti ucuz modele
 * almak kod değişikliği gerektirmemeli.
 */
function overrideModels(env: Env, base: AiModels): AiModels {
  return {
    chat: trimmed(env, "AI_CHAT_MODEL") ?? base.chat,
    transcribe: trimmed(env, "AI_TRANSCRIBE_MODEL") ?? base.transcribe,
    speech: trimmed(env, "AI_SPEECH_MODEL") ?? base.speech,
    image: trimmed(env, "AI_IMAGE_MODEL") ?? base.image,
  };
}

/** Ortamdan sağlayıcıyı çözer. Saf: test edilebilir, süreç ortamına bakmaz. */
export function resolveAiProvider(env: Env): AiProviderConfig {
  const openAiKey = trimmed(env, "OPENAI_API_KEY");
  if (openAiKey) {
    return {
      name: "openai",
      apiKey: openAiKey,
      baseUrl: OPENAI_BASE_URL,
      headers: { Authorization: `Bearer ${openAiKey}` },
      models: overrideModels(env, OPENAI_MODELS),
    };
  }

  // Yedek yol varsayılan KAPALI: açıkça istenmediyse Lovable geçidine düşmez.
  const fallbackAllowed = trimmed(env, "AI_ALLOW_LOVABLE_FALLBACK")?.toLowerCase() === "true";
  const lovableKey = trimmed(env, "LOVABLE_API_KEY");
  if (fallbackAllowed && lovableKey) {
    return {
      name: "lovable",
      apiKey: lovableKey,
      baseUrl: LOVABLE_BASE_URL,
      headers: {
        "Lovable-API-Key": lovableKey,
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
      models: overrideModels(env, LOVABLE_MODELS),
    };
  }

  throw new Error(
    "Yapay zekâ şu an yapılandırılmadı. Sistem yöneticisi OpenAI anahtarını ekledikten sonra çalışacak.",
  );
}

/**
 * Responses API sağlayıcı seçenekleri.
 *
 * `store: false` her çağrıda gerekli (geçmiş yeniden gönderiliyor). Akıl
 * yürütme (reasoning) seçenekleri yalnızca bunu destekleyen modellerde
 * gönderilir: gpt-5.6-luna gibi modeller `reasoning.effort` alanını
 * reddediyor, gönderilirse istek 400 ile düşer.
 */
export function aiResponsesOptions(provider: AiProviderConfig) {
  const model = provider.models.chat;
  const supportsReasoning = /gpt-6|(^|\/)o\d/.test(model);
  return {
    openai: supportsReasoning
      ? {
          forceReasoning: true,
          reasoningEffort: "low",
          reasoningSummary: "auto",
          store: false,
          include: ["reasoning.encrypted_content"],
        }
      : { store: false },
  } as const;
}

/** Süreç ortamından çözer; çağrı yerleri bunu kullanır. */
export function aiProvider(): AiProviderConfig {
  return resolveAiProvider(process.env as Env);
}

/**
 * Sağlayıcının "ödeme/kota" cevabını tek yerde tanır.
 *
 * Lovable geçidi krediler bitince 402 döndürüyor. OpenAI ise 402 KULLANMIYOR:
 * bakiye bittiğinde de, dakikalık hız sınırı aşıldığında da 429 dönüyor ve
 * ikisi ancak gövdedeki koda bakarak ayrılıyor. Bu ayrım kullanıcıya
 * gösterilecek mesajı belirliyor — "bakiye yükleyin" ile "biraz sonra
 * tekrar deneyin" aynı şey değil.
 */
export function aiFailureMessage(status: number, body: string): string | null {
  const quota = /insufficient_quota|exceeded your current quota|billing/i.test(body);
  if (status === 402) return "Yapay zekâ kredisi tükendi.";
  if (status === 429) {
    return quota
      ? "Yapay zekâ bakiyesi tükendi."
      : "Yapay zekâ şu an yoğun, birkaç saniye sonra tekrar deneyin.";
  }
  if (status === 403 && quota) return "Yapay zekâ bakiyesi tükendi.";
  if (status === 401 || status === 403) return "Yapay zekâ anahtarı geçersiz.";

  return null;
}
