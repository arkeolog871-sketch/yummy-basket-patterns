import { createHash, randomInt, timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  OTP_CODE_LENGTH,
  OTP_INVALID_MESSAGE,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_TTL_MINUTES,
  isCompleteOtpCode,
  normalizeOtpCode,
  type OtpEmailPurpose,
} from "@/lib/otp";

/** Yeniden gönderim için minimum bekleme (saniye). */
export const RESEND_COOLDOWN_SECONDS = OTP_RESEND_COOLDOWN_SECONDS;
/** Saatlik en fazla kod gönderimi. */
export const MAX_SENDS_PER_HOUR = 5;
/** Bu sayıda hatalı denemeden sonra mevcut kod geçersiz sayılır. */
export const MAX_FAILED_ATTEMPTS = 5;
/** Kodun geçerlilik süresi (dakika). */
export const CODE_TTL_MINUTES = OTP_TTL_MINUTES;
export { OTP_CODE_LENGTH, OTP_INVALID_MESSAGE };

/** E-posta adresi düz metin saklanmaz; yalnızca tek yönlü özeti tutulur. */
export function hashEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

function generateOtpCode(): string {
  return randomInt(0, 10 ** OTP_CODE_LENGTH)
    .toString()
    .padStart(OTP_CODE_LENGTH, "0");
}

function hashOtpCode(email: string, code: string): string {
  return createHash("sha256").update(`${hashEmail(email)}:${code}`).digest("hex");
}

function hashesEqual(left: string, right: string): boolean {
  try {
    const a = Buffer.from(left, "hex");
    const b = Buffer.from(right, "hex");
    if (a.length === 0 || a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
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

/** Gönderim limitlerini denetler; uygunsa 6 haneli kodu üretir ve özetini kaydeder. */
export async function issueSixDigitCode(
  email: string,
): Promise<{ ok: true; code: string } | { ok: false; error: string; retryAfterSeconds?: number }> {
  const emailHash = hashEmail(email);
  const now = Date.now();
  const row = await loadGuard(emailHash);

  if (row?.last_sent_at) {
    const elapsed = (now - new Date(row.last_sent_at).getTime()) / 1000;
    if (elapsed < RESEND_COOLDOWN_SECONDS) {
      const wait = Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed);
      return { ok: false, error: `Yeni kod için ${wait} saniye bekleyin.`, retryAfterSeconds: wait };
    }
  }

  const windowStart = row ? new Date(row.window_started_at).getTime() : now;
  const windowExpired = now - windowStart >= 60 * 60 * 1000;
  const sends = windowExpired ? 0 : (row?.sends_in_window ?? 0);
  if (sends >= MAX_SENDS_PER_HOUR) {
    return {
      ok: false,
      error: "Saatlik kod gönderim sınırına ulaşıldı. Lütfen bir saat sonra tekrar deneyin.",
    };
  }

  const code = generateOtpCode();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("email_otp_guard").upsert(
    {
      email_hash: emailHash,
      last_sent_at: new Date(now).toISOString(),
      window_started_at: new Date(windowExpired || !row ? now : windowStart).toISOString(),
      sends_in_window: sends + 1,
      failed_attempts: 0,
      locked_until: null,
      code_hash: hashOtpCode(email, code),
      expires_at: new Date(now + CODE_TTL_MINUTES * 60 * 1000).toISOString(),
      updated_at: new Date(now).toISOString(),
    },
    { onConflict: "email_hash" },
  );
  if (error) throw new Error(error.message);
  return { ok: true, code };
}

/** Kod üretmeden yalnızca gönderim kotasını tüketir (ör. kayıtlı olmayan işletme denemesi). */
export async function reserveSend(
  email: string,
): Promise<{ ok: true } | { ok: false; error: string; retryAfterSeconds?: number }> {
  const issued = await issueSixDigitCode(email);
  if (!issued.ok) return issued;
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
  if (!sent.ok) return sent;
  return { ok: true };
}

/** Doğrulama denemesine izin verilip verilmediğini söyler. */
export async function assertCanVerify(
  email: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await loadGuard(hashEmail(email));
  if (!row) return { ok: true };
  const locked = row.locked_until ? new Date(row.locked_until).getTime() > Date.now() : false;
  if (locked || row.failed_attempts >= MAX_FAILED_ATTEMPTS) {
    return {
      ok: false,
      error: "Çok fazla hatalı deneme yaptınız. Mevcut kod geçersiz — yeni kod isteyin.",
    };
  }
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, error: OTP_INVALID_MESSAGE };
  }
  if (!row.expires_at && row.last_sent_at) {
    const ageMinutes = (Date.now() - new Date(row.last_sent_at).getTime()) / 60000;
    if (ageMinutes > CODE_TTL_MINUTES) {
      return { ok: false, error: OTP_INVALID_MESSAGE };
    }
  }
  return { ok: true };
}

/** Saklanan özet ve TTL ile kodu doğrular. */
export async function matchIssuedOtp(email: string, rawCode: unknown): Promise<boolean> {
  const token = normalizeOtpCode(rawCode);
  if (!isCompleteOtpCode(token)) return false;
  const row = await loadGuard(hashEmail(email));
  if (!row?.code_hash) return false;
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return false;
  if (!row.expires_at && row.last_sent_at) {
    const ageMinutes = (Date.now() - new Date(row.last_sent_at).getTime()) / 60000;
    if (ageMinutes > CODE_TTL_MINUTES) return false;
  }
  return hashesEqual(row.code_hash, hashOtpCode(email, token));
}

/** Hatalı denemeyi sayar; sınır aşılırsa mevcut kodu geçersiz kılar. */
export async function registerFailedAttempt(email: string): Promise<number> {
  const emailHash = hashEmail(email);
  const row = await loadGuard(emailHash);
  const attempts = (row?.failed_attempts ?? 0) + 1;
  const locked = attempts >= MAX_FAILED_ATTEMPTS;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("email_otp_guard").upsert(
    {
      email_hash: emailHash,
      window_started_at: row?.window_started_at ?? new Date().toISOString(),
      sends_in_window: row?.sends_in_window ?? 0,
      last_sent_at: row?.last_sent_at ?? null,
      failed_attempts: attempts,
      locked_until: locked ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null,
      code_hash: locked ? null : (row?.code_hash ?? null),
      expires_at: locked ? null : (row?.expires_at ?? null),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "email_hash" },
  );
  if (error) throw new Error(error.message);
  return attempts;
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
export async function createVerifiedSession(email: string): Promise<
  | { ok: true; accessToken: string; refreshToken: string; userId: string }
  | { ok: false; error: string }
> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const userId = await findAuthUserIdByEmail(email);
  if (!userId) {
    return { ok: false, error: OTP_INVALID_MESSAGE };
  }

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

  return {
    ok: true,
    accessToken: verified.data.session.access_token,
    refreshToken: verified.data.session.refresh_token,
    userId,
  };
}

/** OTP sonrası yasal onay kaydı (Kullanım Koşulları / Gizlilik / KVKK). */
export async function recordTermsAcceptance(userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
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
  const response = await fetch(`${url}/auth/v1/admin/users?email=${encodeURIComponent(normalized)}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });
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

/** allowSignUp açıkken hesabı oluşturur; varsa yok sayar. */
export async function ensureAuthUser(email: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: false,
  });
  if (error && !/already|registered|exists/i.test(error.message)) {
    console.error("[otp] kullanıcı hazırlanamadı", { message: error.message });
  }
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
