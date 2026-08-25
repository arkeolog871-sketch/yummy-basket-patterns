import { createHash, timingSafeEqual } from "node:crypto";
import {
  OTP_CODE_LENGTH,
  OTP_EXPIRED_MESSAGE,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_TTL_MINUTES,
  OTP_WRONG_MESSAGE,
  isCompleteOtpCode,
} from "@/lib/otp";

/** Yeniden gönderim için minimum bekleme (saniye). */
export const RESEND_COOLDOWN_SECONDS = OTP_RESEND_COOLDOWN_SECONDS;
/** Saatlik en fazla kod gönderimi. */
export const MAX_SENDS_PER_HOUR = 5;
/** Bu sayıda hatalı denemeden sonra mevcut kod geçersiz sayılır. */
export const MAX_FAILED_ATTEMPTS = 5;
/** Kodun geçerlilik süresi (dakika). */
export const CODE_TTL_MINUTES = OTP_TTL_MINUTES;
/** Brute-force kilidi (dakika). Yeni kod istenmeden deneme yapılamaz. */
export const LOCK_MINUTES = 15;

export type GuardSnapshot = {
  lastSentAtMs: number | null;
  windowStartedAtMs: number;
  sendsInWindow: number;
  failedAttempts: number;
  lockedUntilMs: number | null;
  codeHash: string | null;
  expiresAtMs: number | null;
};

export type OtpInspectResult = "match" | "expired" | "mismatch" | "missing";

/** E-posta adresi düz metin saklanmaz; yalnızca tek yönlü özeti tutulur. */
export function hashEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

export function hashOtpCode(email: string, code: string): string {
  return createHash("sha256").update(`${hashEmail(email)}:${code}`).digest("hex");
}

export function hashesEqual(left: string, right: string): boolean {
  try {
    const a = Buffer.from(left, "hex");
    const b = Buffer.from(right, "hex");
    if (a.length === 0 || a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function evaluateSendLimit(
  row: GuardSnapshot | null,
  nowMs: number,
):
  | { ok: true; sends: number; windowStartMs: number }
  | { ok: false; error: string; retryAfterSeconds?: number } {
  if (row?.lastSentAtMs) {
    const elapsed = (nowMs - row.lastSentAtMs) / 1000;
    if (elapsed < RESEND_COOLDOWN_SECONDS) {
      const wait = Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed);
      return { ok: false, error: `Yeni kod için ${wait} saniye bekleyin.`, retryAfterSeconds: wait };
    }
  }

  const windowStart = row ? row.windowStartedAtMs : nowMs;
  const windowExpired = nowMs - windowStart >= 60 * 60 * 1000;
  const sends = windowExpired ? 0 : (row?.sendsInWindow ?? 0);
  if (sends >= MAX_SENDS_PER_HOUR) {
    return {
      ok: false,
      error: "Saatlik kod gönderim sınırına ulaşıldı. Lütfen bir saat sonra tekrar deneyin.",
    };
  }
  return { ok: true, sends, windowStartMs: windowExpired || !row ? nowMs : windowStart };
}

export function issuedGuardRow(
  previous: GuardSnapshot | null,
  nowMs: number,
  codeHash: string,
): GuardSnapshot {
  const limit = evaluateSendLimit(previous, nowMs);
  if (!limit.ok) {
    throw new Error(limit.error);
  }
  return {
    lastSentAtMs: nowMs,
    windowStartedAtMs: limit.windowStartMs,
    sendsInWindow: limit.sends + 1,
    failedAttempts: 0,
    lockedUntilMs: null,
    codeHash,
    expiresAtMs: nowMs + CODE_TTL_MINUTES * 60 * 1000,
  };
}

export function isGuardExpired(row: GuardSnapshot, nowMs: number): boolean {
  if (row.expiresAtMs != null && row.expiresAtMs < nowMs) return true;
  if (row.expiresAtMs == null && row.lastSentAtMs != null) {
    const ageMinutes = (nowMs - row.lastSentAtMs) / 60000;
    if (ageMinutes > CODE_TTL_MINUTES) return true;
  }
  return false;
}

export function evaluateCanVerify(
  row: GuardSnapshot | null,
  nowMs: number,
): { ok: true } | { ok: false; error: string } {
  if (!row) return { ok: true };
  const locked = row.lockedUntilMs != null ? row.lockedUntilMs > nowMs : false;
  if (locked || row.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    return {
      ok: false,
      error: "Çok fazla hatalı deneme yaptınız. Mevcut kod geçersiz — yeni kod isteyin.",
    };
  }
  if (isGuardExpired(row, nowMs)) {
    return { ok: false, error: OTP_EXPIRED_MESSAGE };
  }
  return { ok: true };
}

export function inspectGuard(
  row: GuardSnapshot | null,
  token: string,
  expectedHash: string,
  nowMs: number,
): OtpInspectResult {
  if (!isCompleteOtpCode(token) || token.length !== OTP_CODE_LENGTH) return "mismatch";
  if (!row?.codeHash) return "missing";
  if (isGuardExpired(row, nowMs)) return "expired";
  return hashesEqual(row.codeHash, expectedHash) ? "match" : "mismatch";
}

export function messageForOtpInspect(result: OtpInspectResult): string {
  if (result === "expired") return OTP_EXPIRED_MESSAGE;
  if (result === "match") return "";
  if (result === "missing") return OTP_EXPIRED_MESSAGE;
  return OTP_WRONG_MESSAGE;
}

export function nextAfterFailedAttempt(row: GuardSnapshot | null, nowMs: number): GuardSnapshot {
  const attempts = (row?.failedAttempts ?? 0) + 1;
  const locked = attempts >= MAX_FAILED_ATTEMPTS;
  return {
    lastSentAtMs: row?.lastSentAtMs ?? null,
    windowStartedAtMs: row?.windowStartedAtMs ?? nowMs,
    sendsInWindow: row?.sendsInWindow ?? 0,
    failedAttempts: attempts,
    lockedUntilMs: locked ? nowMs + LOCK_MINUTES * 60 * 1000 : null,
    codeHash: locked ? null : (row?.codeHash ?? null),
    expiresAtMs: locked ? null : (row?.expiresAtMs ?? null),
  };
}

/** E-posta iletilemezse kullanılabilir kod bırakılmaz; kota sayaçları korunur. */
export function invalidateUndeliveredCode(row: GuardSnapshot): GuardSnapshot {
  return {
    ...row,
    codeHash: null,
    expiresAtMs: null,
  };
}

/** Başarılı eşleşmede kod tek kullanımlık olur; tekrar deneme match dönmez. */
export function consumeMatchingCode(row: GuardSnapshot): GuardSnapshot {
  return {
    ...row,
    codeHash: null,
    expiresAtMs: null,
    failedAttempts: 0,
    lockedUntilMs: null,
  };
}
