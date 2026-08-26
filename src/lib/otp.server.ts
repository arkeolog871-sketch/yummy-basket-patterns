import { randomInt } from "crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  OTP_CODE_LENGTH,
  OTP_EXPIRED_MESSAGE,
  OTP_INVALID_MESSAGE,
  OTP_WRONG_MESSAGE,
  EMAIL_SEND_FAILED_MESSAGE,
  parseExactOtpCode,
  type OtpEmailPurpose,
} from "@/lib/otp";
import {
  CODE_TTL_MINUTES,
  MAX_FAILED_ATTEMPTS,
  MAX_SENDS_PER_HOUR,
  RESEND_COOLDOWN_SECONDS,
  evaluateCanVerify,
  evaluateSendLimit,
  hashEmail,
  hashOtpCode,
  inspectGuard,
  invalidateUndeliveredCode,
  issuedGuardRow,
  messageForOtpInspect,
  nextAfterFailedAttempt,
  type GuardSnapshot,
  type OtpInspectResult,
} from "@/lib/otp-guard";
import { isMissingRpcError } from "@/lib/rpc-fallback";

export {
  RESEND_COOLDOWN_SECONDS,
  MAX_SENDS_PER_HOUR,
  MAX_FAILED_ATTEMPTS,
  CODE_TTL_MINUTES,
  OTP_CODE_LENGTH,
  OTP_INVALID_MESSAGE,
  OTP_WRONG_MESSAGE,
  OTP_EXPIRED_MESSAGE,
  EMAIL_SEND_FAILED_MESSAGE,
  hashEmail,
  messageForOtpInspect,
};
export type { OtpInspectResult };

function generateOtpCode(): string {
  return randomInt(0, 10 ** OTP_CODE_LENGTH)
    .toString()
    .padStart(OTP_CODE_LENGTH, "0");
}

/** Kod e-postası göndermek ve doğrulamak için oturum saklamayan sunucu istemcisi. */
export function createServerAuthClient() {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

type GuardRow = {
  email_hash: string;
  last_sent_at: string | null;
  window_started_at: string;
  sends_in_window: number;
  failed_attempts: number;
  locked_until: string | null;
  code_hash: string | null;
  expires_at: string | null;
};

type IssueRpcResult = { ok: boolean; error?: string; retry_after?: number };

function toSnapshot(row: GuardRow): GuardSnapshot {
  return {
    lastSentAtMs: row.last_sent_at ? new Date(row.last_sent_at).getTime() : null,
    windowStartedAtMs: new Date(row.window_started_at).getTime(),
    sendsInWindow: row.sends_in_window,
    failedAttempts: row.failed_attempts,
    lockedUntilMs: row.locked_until ? new Date(row.locked_until).getTime() : null,
    codeHash: row.code_hash,
    expiresAtMs: row.expires_at ? new Date(row.expires_at).getTime() : null,
  };
}

function toRow(
  emailHash: string,
  snapshot: GuardSnapshot,
  nowIso: string,
): GuardRow & { updated_at: string } {
  return {
    email_hash: emailHash,
    last_sent_at:
      snapshot.lastSentAtMs != null ? new Date(snapshot.lastSentAtMs).toISOString() : null,
    window_started_at: new Date(snapshot.windowStartedAtMs).toISOString(),
    sends_in_window: snapshot.sendsInWindow,
    failed_attempts: snapshot.failedAttempts,
    locked_until:
      snapshot.lockedUntilMs != null ? new Date(snapshot.lockedUntilMs).toISOString() : null,
    code_hash: snapshot.codeHash,
    expires_at: snapshot.expiresAtMs != null ? new Date(snapshot.expiresAtMs).toISOString() : null,
    updated_at: nowIso,
  };
}

async function loadGuard(emailHash: string): Promise<GuardRow | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("email_otp_guard")
    .select(
      "email_hash, last_sent_at, window_started_at, sends_in_window, failed_attempts, locked_until, code_hash, expires_at",
    )
    .eq("email_hash", emailHash)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as GuardRow | null) ?? null;
}

async function saveGuard(emailHash: string, snapshot: GuardSnapshot): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("email_otp_guard")
    .upsert(toRow(emailHash, snapshot, new Date().toISOString()), {
      onConflict: "email_hash",
    });
  if (error) throw new Error(error.message);
}

function issueLimitError(
  error: string,
  retryAfter?: number,
): { ok: false; error: string; retryAfterSeconds?: number } {
  if (error === "cooldown") {
    const wait = retryAfter && retryAfter > 0 ? retryAfter : RESEND_COOLDOWN_SECONDS;
    return { ok: false, error: `Yeni kod için ${wait} saniye bekleyin.`, retryAfterSeconds: wait };
  }
  if (error === "hourly") {
    return {
      ok: false,
      error: "Saatlik kod gönderim sınırına ulaşıldı. Lütfen bir saat sonra tekrar deneyin.",
    };
  }
  return {
    ok: false,
    error: "Doğrulama kodu şu anda gönderilemedi. Lütfen birkaç saniye sonra tekrar deneyin.",
  };
}

async function issueViaRpc(
  emailHash: string,
  codeHash: string,
  nowIso: string,
): Promise<
  | { ok: true }
  | { ok: false; error: string; retryAfterSeconds?: number }
  | { ok: false; missing: true }
> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("issue_email_otp", {
    p_email_hash: emailHash,
    p_code_hash: codeHash,
    p_now: nowIso,
  });
  if (error) {
    if (isMissingRpcError(error)) return { ok: false, missing: true };
    throw new Error(error.message);
  }
  const result = data as IssueRpcResult | null;
  if (!result?.ok) {
    return issueLimitError(result?.error ?? "invalid", result?.retry_after);
  }
  return { ok: true };
}

async function consumeViaRpc(
  emailHash: string,
  codeHash: string,
  nowIso: string,
): Promise<OtpInspectResult | "missing-rpc"> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("consume_email_otp", {
    p_email_hash: emailHash,
    p_code_hash: codeHash,
    p_now: nowIso,
  });
  if (error) {
    if (isMissingRpcError(error)) return "missing-rpc";
    throw new Error(error.message);
  }
  if (data === "match" || data === "expired" || data === "mismatch" || data === "missing") {
    return data;
  }
  return "missing";
}

async function failViaRpc(emailHash: string, nowIso: string): Promise<number | "missing-rpc"> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("register_email_otp_failure", {
    p_email_hash: emailHash,
    p_now: nowIso,
  });
  if (error) {
    if (isMissingRpcError(error)) return "missing-rpc";
    throw new Error(error.message);
  }
  return typeof data === "number" ? data : 0;
}

/** Gönderim limitlerini denetler; uygunsa 6 haneli kodu üretir ve özetini kaydeder. */
export async function issueSixDigitCode(
  email: string,
): Promise<{ ok: true; code: string } | { ok: false; error: string; retryAfterSeconds?: number }> {
  const emailHash = hashEmail(email);
  const now = Date.now();
  const code = generateOtpCode();
  const codeHash = hashOtpCode(email, code);
  const nowIso = new Date(now).toISOString();

  const rpc = await issueViaRpc(emailHash, codeHash, nowIso);
  if (!("missing" in rpc)) {
    if (!rpc.ok) return rpc;
    return { ok: true, code };
  }

  const row = await loadGuard(emailHash);
  const snapshot = row ? toSnapshot(row) : null;
  const limit = evaluateSendLimit(snapshot, now);
  if (!limit.ok) return limit;
  await saveGuard(emailHash, issuedGuardRow(snapshot, now, codeHash));
  return { ok: true, code };
}

/** Kod üretmeden yalnızca gönderim kotasını tüketir (ör. kayıtlı olmayan işletme denemesi). */
export async function reserveSend(
  email: string,
): Promise<{ ok: true } | { ok: false; error: string; retryAfterSeconds?: number }> {
  const issued = await issueSixDigitCode(email);
  if (!issued.ok) return issued;
  const row = await loadGuard(hashEmail(email));
  if (row) await saveGuard(hashEmail(email), invalidateUndeliveredCode(toSnapshot(row)));
  return { ok: true };
}

/** 6 haneli kodu üretir, TTL ile kaydeder ve e-postaya basar. Düz metin kod yanıta yazılmaz. */
export async function sendSixDigitOtp(
  email: string,
  purpose: OtpEmailPurpose = "login",
): Promise<{ ok: true } | { ok: false; error: string; retryAfterSeconds?: number }> {
  const issued = await issueSixDigitCode(email);
  if (!issued.ok) return issued;

  const { sendSixDigitOtpEmail } = await import("./otp-mail.server");
  const sent = await sendSixDigitOtpEmail({ to: email, code: issued.code, purpose });
  if (!sent.ok) {
    console.error("[otp] 6 haneli kod e-postası gönderilemedi", {
      emailHash: hashEmail(email),
      purpose,
      message: sent.error,
    });
    const row = await loadGuard(hashEmail(email));
    if (row) {
      await saveGuard(hashEmail(email), invalidateUndeliveredCode(toSnapshot(row)));
    }
    return { ok: false, error: EMAIL_SEND_FAILED_MESSAGE };
  }
  return { ok: true };
}

/** Doğrulama denemesine izin verilip verilmediğini söyler. */
export async function assertCanVerify(
  email: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await loadGuard(hashEmail(email));
  return evaluateCanVerify(row ? toSnapshot(row) : null, Date.now());
}

/** Saklanan özet ve TTL ile kodu doğrular. */
export async function matchIssuedOtp(email: string, rawCode: unknown): Promise<boolean> {
  return (await inspectIssuedOtp(email, rawCode)) === "match";
}

/** Yanlış kod ile süresi dolmuş kodu ayırır; düz metin kod loglanmaz. */
export async function inspectIssuedOtp(email: string, rawCode: unknown): Promise<OtpInspectResult> {
  const token = parseExactOtpCode(rawCode);
  if (!token) return "mismatch";
  const row = await loadGuard(hashEmail(email));
  return inspectGuard(row ? toSnapshot(row) : null, token, hashOtpCode(email, token), Date.now());
}

/**
 * Doğru kodu tek kullanımlık tüketir. Eşzamanlı tekrar kullanım 0 satır günceller.
 * Tercihen satır kilidiyle RPC; yoksa koşullu UPDATE.
 */
export async function consumeIssuedOtp(email: string, rawCode: unknown): Promise<OtpInspectResult> {
  const token = parseExactOtpCode(rawCode);
  if (!token) return "mismatch";
  const emailHash = hashEmail(email);
  const expectedHash = hashOtpCode(email, token);
  const nowIso = new Date().toISOString();

  const rpc = await consumeViaRpc(emailHash, expectedHash, nowIso);
  if (rpc !== "missing-rpc") return rpc;

  const row = await loadGuard(emailHash);
  const inspected = inspectGuard(row ? toSnapshot(row) : null, token, expectedHash, Date.now());
  if (inspected !== "match" || !row) return inspected;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let query = supabaseAdmin
    .from("email_otp_guard")
    .update({
      code_hash: null,
      expires_at: null,
      failed_attempts: 0,
      locked_until: null,
      updated_at: nowIso,
    })
    .eq("email_hash", emailHash)
    .eq("code_hash", expectedHash);
  if (row.expires_at) {
    query = query.gte("expires_at", nowIso);
  }
  const { data, error } = await query.select("email_hash").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return "missing";
  return "match";
}

/** Hatalı denemeyi sayar; sınır aşılırsa mevcut kodu geçersiz kılar. */
export async function registerFailedAttempt(email: string): Promise<number> {
  const emailHash = hashEmail(email);
  const nowIso = new Date().toISOString();
  const rpc = await failViaRpc(emailHash, nowIso);
  if (rpc !== "missing-rpc") return rpc;

  const row = await loadGuard(emailHash);
  const next = nextAfterFailedAttempt(row ? toSnapshot(row) : null, Date.now());
  await saveGuard(emailHash, next);
  return next.failedAttempts;
}

/** Başarılı doğrulamada sayaçları temizler. */
export async function clearGuard(email: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("email_otp_guard").delete().eq("email_hash", hashEmail(email));
}

/**
 * Doğru OTP sonrası e-postayı doğrulanmış işaretler ve oturum jetonları üretir.
 * GoTrue'nun 8 haneli mailer koduna bağlı değildir.
 */
export async function createVerifiedSession(
  email: string,
): Promise<
  | { ok: true; accessToken: string; refreshToken: string; userId: string }
  | { ok: false; error: string }
> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const userId = await findAuthUserIdByEmail(email);
  if (!userId) {
    return { ok: false, error: OTP_INVALID_MESSAGE };
  }

  const before = await supabaseAdmin.auth.admin.getUserById(userId);
  const wasUnconfirmed = !Boolean(before.data.user?.email_confirmed_at);

  await supabaseAdmin.auth.admin.updateUserById(userId, { email_confirm: true });

  // Doğrulanmamış hesaplarda recovery linki reddedilebilir; önce magiclink dene.
  const linkTypes = ["magiclink", "recovery"] as const;
  let hashedToken: string | undefined;
  let emailOtp: string | undefined;
  for (const type of linkTypes) {
    const { data: link, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type,
      email,
    });
    hashedToken = link?.properties?.hashed_token;
    emailOtp = link?.properties?.email_otp;
    if (!linkError && (hashedToken || emailOtp)) break;
  }
  if (!hashedToken && !emailOtp) {
    console.error("[otp] oturum bağlantısı üretilemedi");
    return { ok: false, error: OTP_INVALID_MESSAGE };
  }

  const supabase = createServerAuthClient();
  const attempts = [
    hashedToken ? { token_hash: hashedToken, type: "magiclink" as const } : null,
    hashedToken ? { token_hash: hashedToken, type: "recovery" as const } : null,
    hashedToken ? { token_hash: hashedToken, type: "email" as const } : null,
    emailOtp ? { email, token: emailOtp, type: "magiclink" as const } : null,
    emailOtp ? { email, token: emailOtp, type: "recovery" as const } : null,
    emailOtp ? { email, token: emailOtp, type: "email" as const } : null,
  ].filter((value): value is NonNullable<typeof value> => value !== null);

  let verified: Awaited<ReturnType<typeof supabase.auth.verifyOtp>> | null = null;
  for (const params of attempts) {
    verified = await supabase.auth.verifyOtp(params);
    if (!verified.error && verified.data.session) break;
  }
  if (!verified || verified.error || !verified.data.session) {
    console.error("[otp] oturum doğrulanamadı", { message: verified?.error?.message });
    return { ok: false, error: OTP_INVALID_MESSAGE };
  }

  if (!verified.data.user?.email_confirmed_at) {
    await supabaseAdmin.auth.admin.updateUserById(userId, { email_confirm: true });
  }

  if (wasUnconfirmed) {
    await activateVendorRestaurantOnFirstVerify(userId);
  }

  return {
    ok: true,
    accessToken: verified.data.session.access_token,
    refreshToken: verified.data.session.refresh_token,
    userId,
  };
}

/** İlk e-posta doğrulamasında işletme kaydını vitrine açar. */
async function activateVendorRestaurantOnFirstVerify(userId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: assignment, error } = await supabaseAdmin
    .from("vendor_assignments")
    .select("restaurant_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !assignment?.restaurant_id) return;
  const { error: updateError } = await supabaseAdmin
    .from("restaurants")
    .update({ is_active: true })
    .eq("id", assignment.restaurant_id);
  if (updateError) {
    console.error("[vendor-signup] işletme aktifleştirilemedi", { message: updateError.message });
  }
}

/** OTP sonrası yasal onay kaydı (Kullanım Koşulları / Gizlilik / KVKK). */
export async function recordTermsAcceptance(
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const acceptedAt = new Date().toISOString();
  const { error } = await supabaseAdmin.from("profiles").upsert(
    {
      id: userId,
      terms_accepted: true,
      terms_accepted_at: acceptedAt,
    },
    { onConflict: "id" },
  );
  if (error) {
    console.error("[legal] yasal onay kaydedilemedi", { message: error.message });
    return { ok: false, error: "Yasal onay kaydedilemedi. Lütfen tekrar deneyin." };
  }
  return { ok: true };
}

/** E-postaya bağlı auth kullanıcısı var mı? Yeni hesap açmaz. */
export async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) return null;
  const normalized = email.trim().toLowerCase();
  const response = await fetch(
    `${url}/auth/v1/admin/users?email=${encodeURIComponent(normalized)}`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    },
  );
  if (!response.ok) return null;
  const body = (await response.json()) as {
    users?: Array<{ id?: string; email?: string | null }>;
    id?: string;
    email?: string | null;
  };
  if (body.id && body.email?.toLowerCase() === normalized) return body.id;
  const match = (body.users ?? []).find((user) => user.email?.toLowerCase() === normalized);
  if (match?.id) return match.id;
  return null;
}

/** Hesabın e-postası gerçekten doğrulanmış mı (sunucu tarafı kontrol). */
export async function isEmailVerified(userId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !data.user) return false;
  return Boolean(data.user.email_confirmed_at);
}

/** Doğrulanmamış hesapların kritik işlemleri yapmasını engeller. */
export async function assertVerifiedEmail(userId: string): Promise<void> {
  if (!(await isEmailVerified(userId))) {
    throw new Error("E-posta adresiniz doğrulanmadı. Lütfen size gönderilen 6 haneli kodu girin.");
  }
}

/**
 * Kayıt: hesabı sunucu tarafında doğrulanmamış olarak oluşturur.
 * E-posta gönderimi yapılmaz; kod tek bir akıştan (OTP) gönderilir.
 */
export async function createUnverifiedAccount(input: {
  email: string;
  password: string;
  fullName: string;
  phone: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: false,
    user_metadata: { full_name: input.fullName, phone: input.phone },
  });
  if (!error) return { ok: true };
  if (/already|registered|exists/i.test(error.message)) {
    return { ok: false, error: "Bu e-posta ile bir hesap zaten var. Giriş yapmayı deneyin." };
  }
  console.error("[signup] hesap oluşturulamadı:", error.message);
  return { ok: false, error: "Hesap oluşturulamadı. Lütfen tekrar deneyin." };
}
