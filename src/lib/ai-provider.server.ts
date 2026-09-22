/**
 * Yapay zekâ sağlayıcısının tek karar noktası — yalnızca sunucu tarafı.
 *
 * NEDEN: sağlayıcı beş ayrı dosyada tekrar tekrar kuruluyordu (asistan, ses,
 * arama, içerik üretimi, menü okuma). Sağlayıcı değiştirmek beş dosyaya
 * dokunmak, birini unutmak ise faturanın bir kısmının eski yerden çıkmaya
 * devam etmesi demekti. Karar buraya toplandı.
 *
 * SEÇİM KURALI (üretim): BİRİNCİL sağlayıcı kullanıcının OpenAI geçididir.
 * Lovable geçidi yalnızca
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
  name: "openai" | "lovable" | "supabase-gateway";
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
    // OPENAI_MODEL de kabul edilir: sır panelinde bu adla eklenmiş olabilir.
    chat: trimmed(env, "AI_CHAT_MODEL") ?? trimmed(env, "OPENAI_MODEL") ?? base.chat,
    transcribe: trimmed(env, "AI_TRANSCRIBE_MODEL") ?? base.transcribe,
    speech: trimmed(env, "AI_SPEECH_MODEL") ?? base.speech,
    image: trimmed(env, "AI_IMAGE_MODEL") ?? base.image,
  };
}

/**
 * Bağlı canlı backend'de yayında olan `openai-gateway` fonksiyonunun adresi.
 * OpenAI anahtarı yalnızca o fonksiyonun içinde yaşar; tarayıcıya çıkmaz.
 * Ortamlar ayrıldığında AI_GATEWAY_URL bu varsayılanı güvenli biçimde ezer.
 */
const DEFAULT_AI_GATEWAY_URL =
  "https://poxltwuruskxbympriz.supabase.co/functions/v1/openai-gateway";

function resolveGatewayUrl(env: Env): string {
  const explicit = trimmed(env, "AI_GATEWAY_URL");
  return (explicit ?? DEFAULT_AI_GATEWAY_URL).replace(/\/+$/, "");
}

/**
 * Kullanılabilir sağlayıcıları SIRAYLA verir (ilk seçenek birincil yoldur).
 *
 * NEDEN sıra: geçit fonksiyonu sunucuda yayında olmadığında (404) uygulama
 * kilitlenmesin; varsa doğrudan OpenAI anahtarına düşsün. Lovable yolu bu
 * sıraya ancak açıkça izin verildiğinde girer.
 */
export function resolveAiProviderChain(env: Env): AiProviderConfig[] {
  const chain: AiProviderConfig[] = [];

  // BİRİNCİL yol: kullanıcının Supabase geçidi (openai-gateway → OpenAI).
  const gatewayUrl = resolveGatewayUrl(env);
  // Geçit dışarıdan çağrılabilen bir proxy: kendi kodunda JWT doğrulaması
  // yok. Bu yüzden bağlı projenin publishable anahtarı geçide DAYATILMAZ;
  // yalnızca geçit için ayrıca bir jeton tanımlanmışsa gönderilir.
  const gatewayToken = trimmed(env, "AI_GATEWAY_TOKEN");
  chain.push({
    name: "supabase-gateway",
    apiKey: gatewayToken ?? "",
    baseUrl: gatewayUrl,
    headers: gatewayToken
      ? { Authorization: `Bearer ${gatewayToken}`, apikey: gatewayToken }
      : {},
    models: overrideModels(env, OPENAI_MODELS),
  });

  const openAiKey = trimmed(env, "OPENAI_API_KEY");
  if (openAiKey) {
    chain.push({
      name: "openai",
      apiKey: openAiKey,
      baseUrl: OPENAI_BASE_URL,
      headers: { Authorization: `Bearer ${openAiKey}` },
      models: overrideModels(env, OPENAI_MODELS),
    });
  }

  // Yedek yol varsayılan KAPALI: açıkça istenmediyse Lovable geçidine düşmez.
  const fallbackAllowed = trimmed(env, "AI_ALLOW_LOVABLE_FALLBACK")?.toLowerCase() === "true";
  const lovableKey = trimmed(env, "LOVABLE_API_KEY");
  if (fallbackAllowed && lovableKey) {
    chain.push({
      name: "lovable",
      apiKey: lovableKey,
      baseUrl: LOVABLE_BASE_URL,
      headers: {
        "Lovable-API-Key": lovableKey,
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
      models: overrideModels(env, LOVABLE_MODELS),
    });
  }

  return chain;
}

/** Ortamdan sağlayıcıyı çözer. Saf: test edilebilir, süreç ortamına bakmaz. */
export function resolveAiProvider(env: Env): AiProviderConfig {
  const [primary] = resolveAiProviderChain(env);
  if (primary) return primary;
  throw new Error(`Yapay zekâ şu an yapılandırılmadı. ${aiKeyHint(env)}`);
}

/**
 * Sunucunun hangi yapay zekâ anahtarını GÖRDÜĞÜNÜ söyler.
 *
 * NEDEN: sır panele eklendikten ve uygulama yeniden yayınlandıktan sonra da
 * hata sürüyordu. Bu noktada iki ihtimal birbirine benziyor ve dışarıdan
 * ayrılamıyor: sır sunucuya hiç ulaşmamış olabilir, ya da ulaşmış ama adı
 * beklenenden farklı yazılmış olabilir. İkisinin çözümü ayrı.
 *
 * GÜVENLİK: yalnızca VARLIK bildiriliyor; hiçbir anahtar değeri, hiçbir
 * parça, hiçbir uzunluk yazılmıyor. Ortam değişkeni adları da olduğu gibi
 * basılmıyor — public-error.ts o adları içeren mesajları zaten siliyor.
 */
export function aiKeyHint(env: Env): string {
  const names = Object.keys(env);
  const openAiNames = names.filter((name) => /openai/i.test(name));
  const hasExactName = openAiNames.some((name) => name === "OPENAI_API_KEY");
  const hasValue = Boolean(trimmed(env, "OPENAI_API_KEY"));
  const lovable = trimmed(env, "LOVABLE_API_KEY") ? " Lovable anahtarı görünüyor." : "";

  if (hasValue) {
    // Buraya normalde düşülmez (anahtar varsa yukarıda dönülür); yedek
    // yolun kapalı olduğu bir yapılandırma hatasıdır.
    return `OpenAI anahtarı sunucuda görünüyor.${lovable}`;
  }
  if (openAiNames.length === 0) {
    return `Sunucu yapay zekâ geçidi adresini ve OpenAI anahtarını hiç görmüyor: yapılandırma bu ortama ulaşmamış olabilir.${lovable}`;
  }

  if (!hasExactName) {
    return `OpenAI sırrı farklı bir adla tanımlı görünüyor; adın tam olarak beklenen hâlde olması gerekiyor.${lovable}`;
  }
  return `OpenAI sırrı tanımlı ama değeri boş görünüyor.${lovable}`;
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
 * Ses uçları için yalnızca kullanıcının sunucu geçidini döndürür.
 *
 * Bu ayrı çözümleyici bilinçlidir: süreçte doğrudan OpenAI anahtarı veya
 * Lovable yedeği bulunsa bile STT/TTS çağrısı sağlayıcı zincirine girmez.
 * OPENAI_API_KEY yalnızca uzaktaki openai-gateway fonksiyonunda kalır.
 */
export function voiceGatewayProvider(env: Env = process.env as Env): AiProviderConfig {
  const gatewayToken = trimmed(env, "AI_GATEWAY_TOKEN");
  return {
    name: "supabase-gateway",
    apiKey: gatewayToken ?? "",
    baseUrl: resolveGatewayUrl(env),
    headers: gatewayToken
      ? { Authorization: `Bearer ${gatewayToken}`, apikey: gatewayToken }
      : {},
    models: overrideModels(env, OPENAI_MODELS),
  };
}

/**
 * Çalışma anında KULLANILABİLİR sağlayıcıyı verir.
 *
 * NEDEN: geçit fonksiyonu sunucuda yayında değilse her istek 404 alıyor ve
 * asistan tümden susuyordu. Artık geçit bir kez yoklanır; "fonksiyon yok"
 * cevabı gelirse o adres ölü işaretlenir ve sıradaki sağlayıcı (doğrudan
 * OpenAI) kullanılır. Yoklama süreç başına bir kezdir, istek başına değil.
 */
const deadAiBaseUrls = new Set<string>();
const probedAiBaseUrls = new Map<string, Promise<boolean>>();

async function gatewayReachable(provider: AiProviderConfig): Promise<boolean> {
  const cached = probedAiBaseUrls.get(provider.baseUrl);
  if (cached) return cached;

  const probe = (async () => {
    try {
      const response = await fetch(`${provider.baseUrl}/responses`, {
        method: "POST",
        headers: { "content-type": "application/json", ...provider.headers },
        body: "{}",
      });
      if (response.status === 404) {
        const body = await response.text().catch(() => "");
        if (/NOT_FOUND|function was not found/i.test(body)) {
          deadAiBaseUrls.add(provider.baseUrl);
          return false;
        }
      }
      return true;
    } catch {
      // Ağ hatası kalıcı sayılmaz: bir sonraki istekte tekrar denenir.
      probedAiBaseUrls.delete(provider.baseUrl);
      return true;
    }
  })();

  probedAiBaseUrls.set(provider.baseUrl, probe);
  return probe;
}

export async function aiProviderForUse(): Promise<AiProviderConfig> {
  const chain = resolveAiProviderChain(process.env as Env).filter(
    (candidate) => !deadAiBaseUrls.has(candidate.baseUrl),
  );

  for (const candidate of chain) {
    if (candidate.name !== "supabase-gateway") return candidate;
    if (await gatewayReachable(candidate)) return candidate;
  }

  const [fallback] = resolveAiProviderChain(process.env as Env);
  if (fallback) return fallback;
  throw new Error(`Yapay zekâ şu an yapılandırılmadı. ${aiKeyHint(process.env as Env)}`);
}

/** Geçit isteği "fonksiyon yok" dediğinde çağrı yerleri bunu bildirir. */
export function markAiProviderUnavailable(baseUrl: string) {
  deadAiBaseUrls.add(baseUrl);
}

/**
 * Bir sağlayıcıya ULAŞILAMADIĞINDA sıradakini verir.
 *
 * NEDEN: geçit adresi çözümlenmediğinde `fetch` istisna atıyor ve yoklama bunu
 * "kalıcı değil" saydığı için aynı ölü adres her istekte yeniden seçiliyordu.
 * Çağrı yeri bir kez yeniden deneyebilsin diye ölü işaretleme + sıradaki
 * sağlayıcı seçimi tek yerde toplandı. Zincirde başka sağlayıcı yoksa null.
 */
export async function nextAiProviderAfterFailure(
  failed: AiProviderConfig,
): Promise<AiProviderConfig | null> {
  markAiProviderUnavailable(failed.baseUrl);
  const next = resolveAiProviderChain(process.env as Env).find(
    (candidate) => !deadAiBaseUrls.has(candidate.baseUrl),
  );
  return next ?? null;
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
  // Geçit fonksiyonu (openai-gateway) sunucuda yoksa buraya düşer.
  if (status === 404 && /NOT_FOUND|function was not found/i.test(body)) {
    return "Yapay zekâ geçidi sunucuda bulunamadı; yöneticinin geçidi yayına alması gerekiyor.";
  }

  return null;
}
