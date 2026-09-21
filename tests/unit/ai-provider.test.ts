import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { aiFailureMessage, aiResponsesOptions, resolveAiProvider } from "@/lib/ai-provider.server";

/**
 * Bu modülün kararı faturanın nereden çıkacağını belirliyor. Yanlış seçim
 * sessizce eski sağlayıcıdan harcamaya devam etmek demek; o yüzden seçim
 * kuralı ve model adları tek tek ölçülüyor.
 */
describe("yapay zekâ sağlayıcısı seçimi", () => {
  it("OPENAI_API_KEY varsa doğrudan OpenAI kullanılır", () => {
    const config = resolveAiProvider({ OPENAI_API_KEY: "sk-test", LOVABLE_API_KEY: "lov" });
    expect(config.name).toBe("openai");
    expect(config.baseUrl).toBe("https://api.openai.com/v1");
    expect(config.headers).toEqual({ Authorization: "Bearer sk-test" });
    // Geçide özel başlık OpenAI'ye GİTMEMELİ.
    expect(config.headers["Lovable-API-Key"]).toBeUndefined();
  });

  it("OpenAI'de model adları öneksiz", () => {
    // "openai/gpt-6-astra" geçidin adlandırması; OpenAI bunu tanımaz.
    const { models } = resolveAiProvider({ OPENAI_API_KEY: "sk-test" });
    expect(models.chat).toBe("gpt-5.6-luna");
    expect(models.speech).toBe("gpt-4o-mini-tts");
    expect(models.image).toBe("gpt-image-1");
    for (const model of Object.values(models)) {
      expect(model).not.toContain("/");
    }
  });

  it("Google ses modeli OpenAI karşılığıyla değişir", () => {
    // google/gemini-3.5-transcribe OpenAI'de yok; istek 404 dönerdi.
    const openai = resolveAiProvider({ OPENAI_API_KEY: "sk-test" });
    const lovable = resolveAiProvider({
      LOVABLE_API_KEY: "lov",
      AI_ALLOW_LOVABLE_FALLBACK: "true",
    });
    expect(lovable.models.transcribe).toBe("google/gemini-3.5-transcribe");
    expect(openai.models.transcribe).toBe("gpt-4o-transcribe");
  });

  it("OpenAI anahtarı yoksa ve yedek açıkken Lovable geçidine düşer", () => {
    const config = resolveAiProvider({
      LOVABLE_API_KEY: "lov",
      AI_ALLOW_LOVABLE_FALLBACK: "true",
    });
    expect(config.name).toBe("lovable");
    expect(config.baseUrl).toBe("https://ai.gateway.lovable.dev/v1");
    expect(config.headers["Lovable-API-Key"]).toBe("lov");
    expect(config.models.chat).toBe("openai/gpt-6-astra");
  });

  it("boş ve boşluklu anahtar yok sayılır", () => {
    // Sır alanı boş bırakılırsa OpenAI'ye boş anahtarla gidilmemeli.
    for (const value of ["", "   "]) {
      expect(
        resolveAiProvider({
          OPENAI_API_KEY: value,
          LOVABLE_API_KEY: "lov",
          AI_ALLOW_LOVABLE_FALLBACK: "true",
        }).name,
      ).toBe("lovable");
    }
  });

  it("anahtarlar kırpılır", () => {
    expect(resolveAiProvider({ OPENAI_API_KEY: "  sk-test\n" }).apiKey).toBe("sk-test");
  });

  it("hiç anahtar yoksa güvenli Türkçe hata verir", () => {
    expect(() => resolveAiProvider({})).toThrow(/Yapay zekâ şu an yapılandırılmadı/);
  });

  it("yedek varsayılan KAPALI: OpenAI anahtarı yokken Lovable'a düşmez", () => {
    // Harcamanın sessizce Lovable kredilerine kayması engelleniyor.
    expect(() => resolveAiProvider({ LOVABLE_API_KEY: "lov" })).toThrow(
      /Yapay zekâ şu an yapılandırılmadı/,
    );
    for (const flag of ["false", "1", "TRUE ", "yes"]) {
      const env = { LOVABLE_API_KEY: "lov", AI_ALLOW_LOVABLE_FALLBACK: flag };
      if (flag === "TRUE ") {
        expect(resolveAiProvider(env).name).toBe("lovable");
      } else {
        expect(() => resolveAiProvider(env)).toThrow();
      }
    }
  });

  it("hata mesajı gerçek anahtarı sızdırmaz", () => {
    try {
      resolveAiProvider({});
    } catch (error) {
      expect((error as Error).message).not.toContain("sk-");
    }
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
      expect(source, `${file} sağlayıcıyı kullanmıyor`).toContain("aiProvider(");
    }
  });
});
