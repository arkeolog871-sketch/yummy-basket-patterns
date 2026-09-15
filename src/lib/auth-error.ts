/**
 * Supabase Auth (GoTrue) hataları İngilizce ve teknik gelir
 * ("Invalid login credentials", "Email not confirmed"). Giriş ekranında ham
 * hâliyle gösterilmeleri hem Türkçe arayüzü bozuyor hem de Apple incelemesinde
 * kullanıcıya hata kodu gösteren ekran olarak görünüyordu.
 */

const DEFAULT_FALLBACK = "Giriş yapılamadı. Bilgilerinizi kontrol edip tekrar deneyin.";

type AuthErrorLike = { message?: unknown; code?: unknown; status?: unknown };

function readParts(error: unknown): { message: string; code: string } {
  if (typeof error === "string") return { message: error, code: "" };
  if (error && typeof error === "object") {
    const named = error as AuthErrorLike;
    return {
      message: typeof named.message === "string" ? named.message : "",
      code: typeof named.code === "string" ? named.code : "",
    };
  }
  return { message: "", code: "" };
}

export function humanizeAuthError(error: unknown, fallback = DEFAULT_FALLBACK): string {
  const { message, code } = readParts(error);
  const text = `${code} ${message}`.toLowerCase();
  if (!text.trim()) return fallback;

  if (text.includes("invalid_credentials") || text.includes("invalid login credentials")) {
    return "E-posta veya şifre hatalı.";
  }
  if (text.includes("email_not_confirmed") || text.includes("email not confirmed")) {
    return "E-posta adresiniz henüz doğrulanmadı. Size gönderilen 6 haneli kodu girin.";
  }
  if (text.includes("user_already_exists") || text.includes("already registered")) {
    return "Bu e-posta ile zaten bir hesap var. Giriş yapmayı deneyin.";
  }
  if (text.includes("weak_password") || text.includes("password should be at least")) {
    return "Şifre en az 6 karakter olmalı.";
  }
  if (
    text.includes("over_email_send_rate_limit") ||
    text.includes("over_request_rate_limit") ||
    text.includes("rate limit") ||
    text.includes("for security purposes")
  ) {
    return "Çok fazla deneme yapıldı. Lütfen bir süre bekleyip tekrar deneyin.";
  }
  if (text.includes("signup_disabled") || text.includes("signups not allowed")) {
    return "Yeni kayıt şu anda kapalı.";
  }
  if (text.includes("user_banned")) {
    return "Bu hesap askıya alınmış. Sayfa yöneticisi ile iletişime geçin.";
  }
  if (
    text.includes("failed to fetch") ||
    text.includes("network") ||
    text.includes("load failed") ||
    text.includes("timeout")
  ) {
    return "İnternet bağlantınızı kontrol edip tekrar deneyin.";
  }
  if (text.includes("session_not_found") || text.includes("refresh_token")) {
    return "Oturumunuzun süresi doldu. Lütfen yeniden giriş yapın.";
  }

  // Eşleşme yoksa da ham İngilizce/teknik metni ekrana basma.
  return fallback;
}
