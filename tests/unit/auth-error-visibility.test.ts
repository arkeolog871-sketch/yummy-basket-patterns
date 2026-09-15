import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { humanizeAuthError } from "@/lib/auth-error";

const ROOT = join(import.meta.dirname, "../..");

function read(relative: string): string {
  return readFileSync(join(ROOT, relative), "utf8");
}

/** Yorum satırları, kaynak kodda hata metni arayan testleri yanıltmasın. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("humanizeAuthError", () => {
  it("ham İngilizce GoTrue metnini Türkçeye çevirir", () => {
    expect(humanizeAuthError({ message: "Invalid login credentials" })).toBe(
      "E-posta veya şifre hatalı.",
    );
    expect(humanizeAuthError({ message: "Email not confirmed" })).toContain("doğrulanmadı");
    expect(humanizeAuthError({ message: "User already registered" })).toContain("zaten bir hesap");
  });

  it("supabase-js kod alanını da tanır", () => {
    expect(humanizeAuthError({ code: "invalid_credentials", message: "" })).toBe(
      "E-posta veya şifre hatalı.",
    );
    expect(humanizeAuthError({ code: "over_request_rate_limit" })).toContain("bekleyip");
    expect(humanizeAuthError({ code: "weak_password" })).toContain("6 karakter");
  });

  it("tanımadığı hiçbir teknik metni kullanıcıya geçirmez", () => {
    const technical = [
      "AuthApiError: unexpected_failure (500)",
      "AuthorizationError error 1000",
      "PGRST301 JWT expired",
      "TypeError: undefined is not an object",
    ];
    for (const message of technical) {
      const shown = humanizeAuthError({ message }, "Giriş yapılamadı.");
      expect(shown).toBe("Giriş yapılamadı.");
      expect(shown).not.toContain(message);
    }
  });

  it("boş hata için yedek mesaj döner", () => {
    expect(humanizeAuthError(null, "Yedek.")).toBe("Yedek.");
    expect(humanizeAuthError({}, "Yedek.")).toBe("Yedek.");
  });
});

describe("giriş ekranı ham hata metni göstermez", () => {
  it("auth.tsx hiçbir toast'ta error.message'ı doğrudan basmaz", () => {
    const source = stripComments(read("src/routes/auth.tsx"));
    const rawToasts = source.match(/toast\.error\(\s*error instanceof Error \? error\.message/g);
    expect(rawToasts).toBeNull();
  });

  it("native iOS giriş hataları sistem hata kaydına gider", () => {
    const source = stripComments(read("src/routes/auth.tsx"));
    expect(source).toContain("reportSignInFailure");
    expect(source).toContain('"ios-native-google"');
    expect(source).toContain('"ios-native-apple"');
  });

  it("e-posta kodu ekranı yakalanan hatayı sanitize eder", () => {
    const source = stripComments(read("src/components/auth/EmailCodeLogin.tsx"));
    expect(source).not.toMatch(/caught instanceof Error \? caught\.message/);
    expect(source).toContain("toPublicErrorMessage(caught");
  });
});
