import { describe, expect, it } from "vitest";
import { toPublicErrorMessage } from "@/lib/public-error";

describe("public error sanitization", () => {
  it("hides stack traces, SQL, and secret-like text", () => {
    expect(
      toPublicErrorMessage("Error: boom\n    at Object.<anonymous> (/app/src/lib/otp.server.ts:12:3)"),
    ).toBe("İşlem şu anda tamamlanamadı. Lütfen tekrar deneyin.");
    expect(toPublicErrorMessage("permission denied for table orders")).toMatch(/tamamlanamadı/);
    expect(toPublicErrorMessage("JWT expired PGRST301")).toMatch(/tamamlanamadı/);
    expect(toPublicErrorMessage("<html>supabase stack</html>")).toMatch(/tamamlanamadı/);
  });

  it("keeps short user-facing messages", () => {
    expect(toPublicErrorMessage("Doğrulama kodu hatalı.")).toBe("Doğrulama kodu hatalı.");
    expect(toPublicErrorMessage("Unauthorized")).toMatch(/Oturumunuz geçersiz/);
    expect(toPublicErrorMessage("Forbidden: İşletme yetkisi bulunmuyor")).toBe(
      "İşletme yetkisi bulunmuyor",
    );
  });
});
