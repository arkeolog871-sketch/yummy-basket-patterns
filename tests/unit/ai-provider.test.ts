import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  aiFailureMessage,
  aiKeyHint,
  aiResponsesOptions,
  resolveAiProvider,
  resolveAiProviderChain,
  voiceGatewayProvider,
} from "@/lib/ai-provider.server";

/**
 * Bu modülün kararı faturanın nereden çıkacağını belirliyor. Yanlış seçim
 * sessizce eski sağlayıcıdan harcamaya devam etmek demek; o yüzden seçim
 * kuralı ve model adları tek tek ölçülüyor.
 */
describe("yapay zekâ sağlayıcısı seçimi", () => {
  /** Sıradaki belirli sağlayıcıyı verir; birincil yol artık her zaman geçit. */
  const byName = (env: Record<string, string | undefined>, name: string) => {
    const found = resolveAiProviderChain(env).find((item) => item.name === name);
    expect(found, `sağlayıcı sırada yok: ${name}`).toBeDefined();
    return found!;
  };

  it("birincil yol her zaman kullanıcının Supabase geçidi", () => {
    const config = resolveAiProvider({ OPENAI_API_KEY: "sk-test", LOVABLE_API_KEY: "lov" });
    expect(config.name).toBe("supabase-gateway");
    expect(config.baseUrl).toBe(
      "https://poxltwuruskxbympriz.supabase.co/functions/v1/openai-gateway",
    );
    expect(config.headers["Lovable-API-Key"]).toBeUndefined();
  });

  it("OPENAI_API_KEY varsa doğrudan OpenAI yolu sırada durur", () => {
    const config = byName({ OPENAI_API_KEY: "sk-test", LOVABLE_API_KEY: "lov" }, "openai");
    expect(config.baseUrl).toBe("https://api.openai.com/v1");
    expect(config.headers).toEqual({ Authorization: "Bearer sk-test" });
    expect(config.headers["Lovable-API-Key"]).toBeUndefined();
  });

  it("OpenAI'de model adları öneksiz", () => {
    // "openai/gpt-6-astra" geçidin adlandırması; OpenAI bunu tanımaz.
    const { models } = byName({ OPENAI_API_KEY: "sk-test" }, "openai");
    expect(models.chat).toBe("gpt-5.6-luna");
    expect(models.speech).toBe("gpt-4o-mini-tts");
    expect(models.image).toBe("gpt-image-1");
    for (const model of Object.values(models)) {
      expect(model).not.toContain("/");
    }
  });

  it("Google ses modeli OpenAI karşılığıyla değişir", () => {
    // google/gemini-3.5-transcribe OpenAI'de yok; istek 404 dönerdi.
    const openai = byName({ OPENAI_API_KEY: "sk-test" }, "openai");
    const lovable = byName(
      { LOVABLE_API_KEY: "lov", AI_ALLOW_LOVABLE_FALLBACK: "true" },
      "lovable",
    );
    expect(lovable.models.transcribe).toBe("google/gemini-3.5-transcribe");
    expect(openai.models.transcribe).toBe("gpt-4o-transcribe");
  });

  it("yedek açıkken Lovable yolu sıranın SONUNDA durur", () => {
    const chain = resolveAiProviderChain({
      LOVABLE_API_KEY: "lov",
      AI_ALLOW_LOVABLE_FALLBACK: "true",
    });
    expect(chain.map((item) => item.name)).toEqual(["supabase-gateway", "lovable"]);
    const config = chain[1]!;
    expect(config.baseUrl).toBe("https://ai.gateway.lovable.dev/v1");
    expect(config.headers["Lovable-API-Key"]).toBe("lov");
    expect(config.models.chat).toBe("openai/gpt-6-astra");
  });

  it("boş ve boşluklu anahtar yok sayılır", () => {
    // Sır alanı boş bırakılırsa OpenAI yolu sıraya hiç girmemeli.
    for (const value of ["", "   "]) {
      const chain = resolveAiProviderChain({
        OPENAI_API_KEY: value,
        LOVABLE_API_KEY: "lov",
        AI_ALLOW_LOVABLE_FALLBACK: "true",
      });
      expect(chain.map((item) => item.name)).toEqual(["supabase-gateway", "lovable"]);
    }
  });

  it("anahtarlar kırpılır", () => {
    expect(byName({ OPENAI_API_KEY: "  sk-test\n" }, "openai").apiKey).toBe("sk-test");
  });

  it("yedek varsayılan KAPALI: Lovable yolu izin verilmedikçe sıraya girmez", () => {
    // Harcamanın sessizce Lovable kredilerine kayması engelleniyor.
    for (const flag of [undefined, "false", "1", "yes"]) {
      const chain = resolveAiProviderChain({
        LOVABLE_API_KEY: "lov",
        ...(flag ? { AI_ALLOW_LOVABLE_FALLBACK: flag } : {}),
      });
      expect(chain.map((item) => item.name)).toEqual(["supabase-gateway"]);
    }
    expect(
      resolveAiProviderChain({
        LOVABLE_API_KEY: "lov",
        AI_ALLOW_LOVABLE_FALLBACK: "TRUE ",
      }).map((item) => item.name),
    ).toEqual(["supabase-gateway", "lovable"]);
  });

  it("model adları ortamdan ezilebilir", () => {
    // Maliyet için ucuz modele geçmek kod değişikliği gerektirmemeli.
    const config = resolveAiProvider({
      OPENAI_API_KEY: "sk-test",
      AI_CHAT_MODEL: "gpt-5.6-luna",
      AI_TRANSCRIBE_MODEL: "gpt-4o-mini-transcribe",
    });
    expect(config.models.chat).toBe("gpt-5.6-luna");
    expect(config.models.transcribe).toBe("gpt-4o-mini-transcribe");
    // Verilmeyenler varsayılan kalır.
    expect(config.models.speech).toBe("gpt-4o-mini-tts");
  });

  it("OPENAI_MODEL de sohbet modelini ezer, AI_CHAT_MODEL önce gelir", () => {
    expect(
      resolveAiProvider({ OPENAI_API_KEY: "sk-test", OPENAI_MODEL: "gpt-5.6-terra" }).models.chat,
    ).toBe("gpt-5.6-terra");
    expect(
      resolveAiProvider({
        OPENAI_API_KEY: "sk-test",
        OPENAI_MODEL: "gpt-5.6-terra",
        AI_CHAT_MODEL: "gpt-5.6-luna",
      }).models.chat,
    ).toBe("gpt-5.6-luna");
  });

  it("ezme Lovable geçidinde de çalışır", () => {
    const config = resolveAiProvider({
      LOVABLE_API_KEY: "lov",
      AI_ALLOW_LOVABLE_FALLBACK: "true",
      AI_CHAT_MODEL: "openai/gpt-5.6-luna",
    });
    expect(config.models.chat).toBe("openai/gpt-5.6-luna");
  });
});

describe("Responses API seçenekleri modele uyar", () => {
  it("gpt-5.6-luna reasoning alanı almaz", () => {
    // Bu model reasoning.effort alanını reddediyor; gönderilirse istek 400 düşer.
    const options = aiResponsesOptions(resolveAiProvider({ OPENAI_API_KEY: "sk-test" }));
    expect(options.openai).toEqual({ store: false });
  });

  it("gpt-6-astra reasoning ayarlarını korur", () => {
    const options = aiResponsesOptions(
      resolveAiProvider({ OPENAI_API_KEY: "sk-test", AI_CHAT_MODEL: "gpt-6-astra" }),
    );
    expect(options.openai).toMatchObject({ forceReasoning: true, store: false });
  });
});

describe("sağlayıcı hata cevapları", () => {
  it("Lovable kredisi bitince 402", () => {
    expect(aiFailureMessage(402, "")).toBe("Yapay zekâ kredisi tükendi.");
  });

  it("OpenAI bakiyesi bitince 429 + insufficient_quota", () => {
    // OpenAI 402 KULLANMIYOR; bakiye bitişi de hız sınırı da 429 dönüyor.
    // Ayrım gövdedeki koda bakmaktan geçiyor.
    const body =
      '{"error":{"code":"insufficient_quota","message":"You exceeded your current quota"}}';
    expect(aiFailureMessage(429, body)).toBe("Yapay zekâ bakiyesi tükendi.");
  });

  it("OpenAI hız sınırında bakiye mesajı verilmez", () => {
    const body = '{"error":{"code":"rate_limit_exceeded","message":"Rate limit reached"}}';
    expect(aiFailureMessage(429, body)).toContain("yoğun");
    expect(aiFailureMessage(429, body)).not.toContain("bakiye");
  });

  it("403 + kota gövdesi bakiye mesajı verir", () => {
    expect(aiFailureMessage(403, '{"error":{"code":"insufficient_quota"}}')).toBe(
      "Yapay zekâ bakiyesi tükendi.",
    );
  });

  it("geçersiz anahtar ayrı mesaj alır", () => {
    expect(aiFailureMessage(401, "")).toBe("Yapay zekâ anahtarı geçersiz.");
    expect(aiFailureMessage(403, "")).toBe("Yapay zekâ anahtarı geçersiz.");
  });

  it("diğer hatalar çağırana bırakılır", () => {
    expect(aiFailureMessage(500, "")).toBeNull();
    expect(aiFailureMessage(404, "")).toBeNull();
  });
});

describe("sağlayıcı tek yerden seçiliyor", () => {
  it("yapay zekâ modülleri geçidi elle kurmaz", () => {
    // Sağlayıcı beş dosyada tekrar kurulduğunda birini unutmak, faturanın
    // bir kısmının eski yerden çıkmaya devam etmesi demekti.
    for (const file of [
      "src/lib/ai-assistant.server.ts",
      "src/lib/ai-voice.server.ts",
      "src/lib/ai-search.server.ts",
      "src/lib/ai-content.server.ts",
      "src/lib/ai-menu-import.server.ts",
    ]) {
      const source = readFileSync(file, "utf8");
      expect(source, `${file} geçit adresini elle yazıyor`).not.toContain("ai.gateway.lovable.dev");
      expect(source, `${file} geçit başlığını elle yazıyor`).not.toContain("Lovable-API-Key");
      expect(source, `${file} anahtarı doğrudan okuyor`).not.toContain(
        'process.env["LOVABLE_API_KEY"]',
      );
      if (file === "src/lib/ai-voice.server.ts") {
        expect(source, `${file} yalnızca ses geçidini kullanmıyor`).toContain(
          "voiceGatewayProvider()",
        );
        expect(source, `${file} genel sağlayıcı zincirine giriyor`).not.toContain(
          "aiProviderForUse",
        );
        expect(source, `${file} başka sağlayıcıya düşüyor`).not.toContain(
          "nextAiProviderAfterFailure",
        );
      } else {
        expect(source, `${file} sağlayıcıyı kullanmıyor`).toContain("aiProviderForUse(");
      }
    }
  });
});

describe("sunucunun gördüğü anahtar bildirilir", () => {
  it("hiç OpenAI sırrı yoksa 'hiç görmüyor' der", () => {
    // Sır panele eklenip yeniden yayınlandıktan sonra da hata sürüyordu;
    // bu iki ihtimali ayırmak için eklendi.
    expect(aiKeyHint({})).toContain("hiç görmüyor");
  });

  it("adı yanlış yazılmış sırrı ayırt eder", () => {
    for (const name of ["OPENAI_KEY", "OPENAI_APIKEY", "openai_api_key", "VITE_OPENAI_API_KEY"]) {
      expect(aiKeyHint({ [name]: "sk-test" }), name).toContain("farklı bir adla");
    }
  });

  it("doğru adla tanımlı ama boş değeri ayırt eder", () => {
    expect(aiKeyHint({ OPENAI_API_KEY: "   " })).toContain("değeri boş");
  });

  it("Lovable anahtarının varlığını da söyler", () => {
    expect(aiKeyHint({ LOVABLE_API_KEY: "lov" })).toContain("Lovable anahtarı görünüyor");
    expect(aiKeyHint({})).not.toContain("Lovable anahtarı görünüyor");
  });

  it("hiçbir anahtar DEĞERİ sızdırmaz", () => {
    // İpucu son kullanıcıya gösteriliyor; değer, parça veya uzunluk yazılmamalı.
    const hint = aiKeyHint({
      OPENAI_API_KEY: "sk-gizli-anahtar-123",
      LOVABLE_API_KEY: "lov-gizli",
    });
    expect(hint).not.toContain("sk-gizli");
    expect(hint).not.toContain("lov-gizli");
    expect(hint).not.toMatch(/\d{2,}/);
  });

  it("ortam değişkeni adlarını olduğu gibi basmaz", () => {
    // public-error.ts bu adları içeren mesajları tamamen siliyor; ipucu
    // kullanıcıya hiç ulaşmazdı.
    const hint = aiKeyHint({ LOVABLE_API_KEY: "lov" });
    expect(hint).not.toContain("OPENAI_API_KEY");
    expect(hint).not.toContain("LOVABLE_API_KEY");
  });

  it("hiçbir anahtar olmasa da geçit yolu kalır", () => {
    expect(resolveAiProvider({}).name).toBe("supabase-gateway");
  });
});

describe("Supabase openai-gateway sağlayıcısı", () => {
  const gatewayEnv = {
    SUPABASE_URL: "https://proje.supabase.co/",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    OPENAI_API_KEY: "sk-test",
  };

  it("geçit bağlı canlı projenin doğrulanmış adresidir", () => {
    const config = resolveAiProvider(gatewayEnv);
    expect(config.name).toBe("supabase-gateway");
    expect(config.baseUrl).toBe(
      "https://poxltwuruskxbympriz.supabase.co/functions/v1/openai-gateway",
    );
    expect(config.baseUrl).toContain("poxltwuruskxbympriz.supabase.co");
  });

  it("geçide bağlı projenin publishable anahtarı dayatılmaz", () => {
    const config = resolveAiProvider(gatewayEnv);
    expect(config.headers["Authorization"]).toBeUndefined();
    expect(config.headers["apikey"]).toBeUndefined();
    expect(config.headers["Lovable-API-Key"]).toBeUndefined();
  });

  it("geçit için ayrı bir jeton tanımlıysa gönderilir", () => {
    const config = resolveAiProvider({ ...gatewayEnv, AI_GATEWAY_TOKEN: "tok" });
    expect(config.headers["Authorization"]).toBe("Bearer tok");
    expect(config.headers["apikey"]).toBe("tok");
  });

  it("geçit üzerinden de sohbet modeli gpt-5.6-luna'dır", () => {
    expect(resolveAiProvider(gatewayEnv).models.chat).toBe("gpt-5.6-luna");
    expect(resolveAiProvider({ ...gatewayEnv, OPENAI_MODEL: "gpt-5.6-terra" }).models.chat).toBe(
      "gpt-5.6-terra",
    );
  });

  it("AI_GATEWAY_URL verilirse o adres kullanılır", () => {
    expect(
      resolveAiProvider({ ...gatewayEnv, AI_GATEWAY_URL: "https://x.dev/functions/v1/gw/" })
        .baseUrl,
    ).toBe("https://x.dev/functions/v1/gw");
  });

  it("geçit fonksiyonu yayında değilse anlaşılır Türkçe mesaj döner", () => {
    expect(
      aiFailureMessage(404, '{"code":"NOT_FOUND","message":"Requested function was not found"}'),
    ).toMatch(/geçidi sunucuda bulunamadı/);
  });
});

describe("sağlayıcı sırası (geçit → doğrudan OpenAI)", () => {
  it("geçit birincil, doğrudan OpenAI yedek sırada durur", () => {
    const chain = resolveAiProviderChain({
      SUPABASE_URL: "https://ref.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
      OPENAI_API_KEY: "sk-test",
    });
    expect(chain.map((item) => item.name)).toEqual(["supabase-gateway", "openai"]);
  });

  it("Lovable yolu izin verilmedikçe sıraya girmez", () => {
    const chain = resolveAiProviderChain({ LOVABLE_API_KEY: "lov", OPENAI_API_KEY: "sk-test" });
    expect(chain.map((item) => item.name)).toEqual(["supabase-gateway", "openai"]);
  });
});

describe("ses sağlayıcısı yalnız kullanıcı geçididir", () => {
  it("doğrudan OpenAI ve Lovable anahtarları olsa da yalnız geçidi döndürür", () => {
    const provider = voiceGatewayProvider({
      OPENAI_API_KEY: "sk-test",
      LOVABLE_API_KEY: "lov",
      AI_ALLOW_LOVABLE_FALLBACK: "true",
    });
    expect(provider.name).toBe("supabase-gateway");
    expect(provider.baseUrl).toBe(
      "https://poxltwuruskxbympriz.supabase.co/functions/v1/openai-gateway",
    );
    expect(provider.headers).toEqual({});
  });

  it("yalnız açıkça tanımlanmış geçit jetonunu gönderir", () => {
    expect(voiceGatewayProvider({ AI_GATEWAY_TOKEN: "tok" }).headers).toEqual({
      Authorization: "Bearer tok",
      apikey: "tok",
    });
  });
});
