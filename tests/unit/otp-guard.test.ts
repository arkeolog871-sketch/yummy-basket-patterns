import { describe, expect, it } from "vitest";
import {
  CODE_TTL_MINUTES,
  MAX_FAILED_ATTEMPTS,
  MAX_SENDS_PER_HOUR,
  consumeMatchingCode,
  evaluateCanVerify,
  evaluateSendLimit,
  hashOtpCode,
  inspectGuard,
  invalidateUndeliveredCode,
  issuedGuardRow,
  nextAfterFailedAttempt,
  type GuardSnapshot,
} from "@/lib/otp-guard";

const EMAIL = "user@example.com";
const CODE = "042861";
const OTHER = "111111";

function issuedAt(now: number): GuardSnapshot {
  return issuedGuardRow(null, now, hashOtpCode(EMAIL, CODE));
}

describe("OTP guard send limits", () => {
  it("issues a hashed 6-digit code with TTL", () => {
    const now = Date.UTC(2026, 7, 25, 12, 0, 0);
    const row = issuedAt(now);
    expect(row.codeHash).toBe(hashOtpCode(EMAIL, CODE));
    expect(row.codeHash).not.toContain(CODE);
    expect(row.expiresAtMs).toBe(now + CODE_TTL_MINUTES * 60 * 1000);
    expect(row.sendsInWindow).toBe(1);
    expect(row.failedAttempts).toBe(0);
  });

  it("rate-limits resend within 60 seconds", () => {
    const now = Date.UTC(2026, 7, 25, 12, 0, 0);
    const row = issuedAt(now);
    const blocked = evaluateSendLimit(row, now + 15_000);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.retryAfterSeconds).toBe(45);
      expect(blocked.error).toMatch(/saniye bekleyin/);
    }
  });

  it("allows a new code after cooldown and invalidates the previous hash", () => {
    const now = Date.UTC(2026, 7, 25, 12, 0, 0);
    const first = issuedAt(now);
    const later = now + 61_000;
    const allowed = evaluateSendLimit(first, later);
    expect(allowed.ok).toBe(true);
    const second = issuedGuardRow(first, later, hashOtpCode(EMAIL, OTHER));
    expect(second.codeHash).not.toBe(first.codeHash);
    expect(inspectGuard(second, CODE, hashOtpCode(EMAIL, CODE), later)).toBe("mismatch");
    expect(inspectGuard(second, OTHER, hashOtpCode(EMAIL, OTHER), later)).toBe("match");
  });

  it("enforces hourly send cap", () => {
    let row: GuardSnapshot | null = null;
    const start = Date.UTC(2026, 7, 25, 12, 0, 0);
    for (let i = 0; i < MAX_SENDS_PER_HOUR; i += 1) {
      const now = start + i * 61_000;
      row = issuedGuardRow(row, now, hashOtpCode(EMAIL, CODE));
    }
    const blocked = evaluateSendLimit(row, start + MAX_SENDS_PER_HOUR * 61_000);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error).toMatch(/Saatlik/);
  });
});

describe("OTP guard verification", () => {
  it("matches the issued code and rejects wrong codes", () => {
    const now = Date.UTC(2026, 7, 25, 12, 0, 0);
    const row = issuedAt(now);
    expect(inspectGuard(row, CODE, hashOtpCode(EMAIL, CODE), now)).toBe("match");
    expect(inspectGuard(row, OTHER, hashOtpCode(EMAIL, OTHER), now)).toBe("mismatch");
    expect(inspectGuard(row, "12345", hashOtpCode(EMAIL, "12345"), now)).toBe("mismatch");
    expect(inspectGuard(null, CODE, hashOtpCode(EMAIL, CODE), now)).toBe("missing");
  });

  it("rejects expired codes even if the digits are correct", () => {
    const now = Date.UTC(2026, 7, 25, 12, 0, 0);
    const row = issuedAt(now);
    const expiredAt = now + (CODE_TTL_MINUTES + 1) * 60 * 1000;
    expect(inspectGuard(row, CODE, hashOtpCode(EMAIL, CODE), expiredAt)).toBe("expired");
    expect(evaluateCanVerify(row, expiredAt).ok).toBe(false);
  });

  it("consumes a matching code so replay fails", () => {
    const now = Date.UTC(2026, 7, 25, 12, 0, 0);
    const row = issuedAt(now);
    const consumed = consumeMatchingCode(row);
    expect(inspectGuard(consumed, CODE, hashOtpCode(EMAIL, CODE), now + 1000)).toBe("missing");
  });

  it("locks after 5 wrong attempts and clears the stored hash", () => {
    const now = Date.UTC(2026, 7, 25, 12, 0, 0);
    let row: GuardSnapshot | null = issuedAt(now);
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i += 1) {
      row = nextAfterFailedAttempt(row, now + i * 1000);
    }
    expect(row.failedAttempts).toBe(MAX_FAILED_ATTEMPTS);
    expect(row.codeHash).toBeNull();
    const blocked = evaluateCanVerify(row, now + 2000);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error).toMatch(/hatalı deneme/);
  });

  it("does not leave a usable code when email delivery fails", () => {
    const now = Date.UTC(2026, 7, 25, 12, 0, 0);
    const row = issuedAt(now);
    const invalidated = invalidateUndeliveredCode(row);
    expect(invalidated.codeHash).toBeNull();
    expect(invalidated.sendsInWindow).toBe(row.sendsInWindow);
    expect(inspectGuard(invalidated, CODE, hashOtpCode(EMAIL, CODE), now)).toBe("missing");
  });
});
