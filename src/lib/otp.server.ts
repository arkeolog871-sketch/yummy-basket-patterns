import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Yeniden gönderim için minimum bekleme (saniye). */
export const RESEND_COOLDOWN_SECONDS = 60;
/** Saatlik en fazla kod gönderimi. */
export const MAX_SENDS_PER_HOUR = 5;
/** Bu sayıda hatalı denemeden sonra mevcut kod geçersiz sayılır. */
export const MAX_FAILED_ATTEMPTS = 5;
/** Kodun geçerlilik süresi (dakika). */
export const CODE_TTL_MINUTES = 10;

/** E-posta adresi düz metin saklanmaz; yalnızca tek yönlü özeti tutulur. */
export function hashEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
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
};

async function loadGuard(emailHash: string): Promise<GuardRow | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("email_otp_guard")
    .select("email_hash, last_sent_at, window_started_at, sends_in_window, failed_attempts, locked_until")
    .eq("email_hash", emailHash)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as GuardRow | null) ?? null;
}

/** Gönderim limitlerini denetler; uygunsa sayaçları günceller. */
export async function reserveSend(
  email: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const emailHash = hashEmail(email);
  const now = Date.now();
  const row = await loadGuard(emailHash);

  if (row?.last_sent_at) {
    const elapsed = (now - new Date(row.last_sent_at).getTime()) / 1000;
    if (elapsed < RESEND_COOLDOWN_SECONDS) {
      const wait = Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed);
      return { ok: false, error: `Yeni kod için ${wait} saniye bekleyin.` };
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

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("email_otp_guard").upsert(
    {
      email_hash: emailHash,
      last_sent_at: new Date(now).toISOString(),
      window_started_at: new Date(windowExpired || !row ? now : windowStart).toISOString(),
      sends_in_window: sends + 1,
      // Yeni kod istendiğinde hatalı deneme sayacı ve kilit sıfırlanır.
      failed_attempts: 0,
      locked_until: null,
      updated_at: new Date(now).toISOString(),
    },
    { onConflict: "email_hash" },
  );
  if (error) throw new Error(error.message);
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
  if (row.last_sent_at) {
    const ageMinutes = (Date.now() - new Date(row.last_sent_at).getTime()) / 60000;
    if (ageMinutes > CODE_TTL_MINUTES) {
      return { ok: false, error: "Doğrulama kodunun süresi doldu. Yeni kod gönderin." };
    }
  }
  return { ok: true };
}


/** Hatalı denemeyi sayar; sınır aşılırsa mevcut kodu geçersiz kılar. */
export async function registerFailedAttempt(email: string): Promise<number> {
  const emailHash = hashEmail(email);
  const row = await loadGuard(emailHash);
  const attempts = (row?.failed_attempts ?? 0) + 1;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("email_otp_guard").upsert(
    {
      email_hash: emailHash,
      window_started_at: row?.window_started_at ?? new Date().toISOString(),
      sends_in_window: row?.sends_in_window ?? 0,
      last_sent_at: row?.last_sent_at ?? null,
      failed_attempts: attempts,
      locked_until:
        attempts >= MAX_FAILED_ATTEMPTS
          ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
          : null,
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
