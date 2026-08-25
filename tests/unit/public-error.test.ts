import { describe, expect, it } from "vitest";
import { toPublicErrorMessage } from "@/lib/public-error";
import { isMissingRpcError } from "@/lib/rpc-fallback";

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

describe("RPC rollout fallback", () => {
  it("detects missing PostgREST/Postgres functions without treating other errors as absent", () => {
    expect(isMissingRpcError({ code: "PGRST202", message: "Could not find the function" })).toBe(true);
    expect(isMissingRpcError({ code: "42883", message: "function public.issue_email_otp does not exist" })).toBe(
      true,
    );
    expect(isMissingRpcError({ message: "stock_quantity check failed" })).toBe(false);
  });
});
