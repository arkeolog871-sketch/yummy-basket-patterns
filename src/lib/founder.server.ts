import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export async function isFounderUser(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "founder",
  });
  if (error) throw new Error(error.message);
  return data === true;
}

type JwtClaims = { aal?: string; amr?: Array<{ method?: string }> } | null | undefined;

/** Kurucu hesabında doğrulanmış TOTP faktörü var mı? */
async function hasVerifiedTotp(userId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.admin.mfa.listFactors({ userId });
  if (error) return false;
  return (data?.factors ?? []).some(
    (factor) => factor.factor_type === "totp" && factor.status === "verified",
  );
}

/** Son 12 saat içinde yedek kod ile doğrulama yapıldı mı? */
async function hasRecentBackupCodeUse(userId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("founder_backup_codes")
    .select("id")
    .eq("user_id", userId)
    .gte("used_at", since)
    .limit(1);
  if (error) return false;
  return (data ?? []).length > 0;
}

/**
 * Kurucu yetkisini ve (TOTP kayıtlıysa) ikinci adım doğrulamasını sunucu tarafında
 * zorunlu kılar. İstemci arayüzü atlanarak istek gönderilse bile 2FA aşılamaz.
 */
export async function assertFounder(
  supabase: SupabaseClient<Database>,
  userId: string,
  claims?: JwtClaims,
): Promise<void> {
  const { assertVerifiedEmail } = await import("./otp.server");
  await assertVerifiedEmail(userId);
  if (!(await isFounderUser(supabase, userId))) throw new Error("Forbidden");
  if (claims === undefined) return;

  const aal = claims?.aal ?? null;
  const amrHasTotp = (claims?.amr ?? []).some((entry) => entry?.method === "totp");
  if (aal === "aal2" || amrHasTotp) return;

  if (!(await hasVerifiedTotp(userId))) return;
  if (await hasRecentBackupCodeUse(userId)) return;

  throw new Error("İki adımlı doğrulama gerekli");
}


type BusinessVendorInput = {
  restaurantId: string;
  businessName: string;
  email: string;
  phone: string;
};

/**
 * İşletme iletişim e-postasını mevcut müşteri hesabıyla birleştirir; hesap yoksa
 * OTP ile etkinleşebilen yeni bir hesap oluşturur ve işletmeye atar.
 */
export async function ensureBusinessVendorAccount(input: BusinessVendorInput): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { normalizePhone } = await import("./vendor-auth.server");
  const email = input.email.trim().toLowerCase();
  const phone = normalizePhone(input.phone);

  const { data: currentAssignment, error: currentAssignmentError } = await supabaseAdmin
    .from("vendor_assignments")
    .select("user_id")
    .eq("restaurant_id", input.restaurantId)
    .maybeSingle();
  if (currentAssignmentError) throw new Error(currentAssignmentError.message);
  if (currentAssignment) return;

  let matchedUserId: string | null = null;
  for (let page = 1; page <= 10 && !matchedUserId; page += 1) {
    const { data: users, error: usersError } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (usersError) throw new Error(usersError.message);
    matchedUserId =
      users.users.find((user) => user.email?.trim().toLowerCase() === email)?.id ?? null;
    if (users.users.length < 200) break;
  }

  if (!matchedUserId) {
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: false,
      user_metadata: { full_name: input.businessName, phone },
    });
    if (createError) throw new Error(createError.message);
    matchedUserId = created.user?.id ?? null;
  }
  if (!matchedUserId) throw new Error("İşletme hesabı oluşturulamadı");

  const { data: otherAssignment, error: otherAssignmentError } = await supabaseAdmin
    .from("vendor_assignments")
    .select("restaurant_id")
    .eq("user_id", matchedUserId)
    .maybeSingle();
  if (otherAssignmentError) throw new Error(otherAssignmentError.message);
  if (otherAssignment && otherAssignment.restaurant_id !== input.restaurantId) {
    throw new Error("Bu e-posta başka bir işletme hesabına atanmış");
  }

  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .upsert(
      { id: matchedUserId, phone, full_name: input.businessName },
      { onConflict: "id" },
    );
  if (profileError) throw new Error(profileError.message);

  const { error: roleError } = await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: matchedUserId, role: "vendor" }, { onConflict: "user_id,role" });
  if (roleError) throw new Error(roleError.message);

  const { error: assignmentError } = await supabaseAdmin.from("vendor_assignments").upsert(
    { user_id: matchedUserId, restaurant_id: input.restaurantId },
    { onConflict: "user_id" },
  );
  if (assignmentError) throw new Error(assignmentError.message);
}