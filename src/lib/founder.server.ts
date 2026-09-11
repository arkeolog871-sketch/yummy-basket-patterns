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

/**
 * Yedek kod kullanımı Supabase'in kendi aal2 iddiasını üretmediği için (özel
 * bir mekanizma), bu pencere yalnızca kodun kullanıldığı giriş akışını
 * tamamlamaya yetecek kadar kısa tutulur — herhangi bir oturumun saatlerce
 * "doğrulanmış" sayılmasını önlemek için (bkz. denetim bulgusu #9).
 */
async function hasRecentBackupCodeUse(userId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
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
  claims: JwtClaims,
): Promise<void> {
  const { assertVerifiedEmail } = await import("./otp.server");
  await assertVerifiedEmail(userId);
  if (!(await isFounderUser(supabase, userId))) throw new Error("Forbidden");

  const aal = claims?.aal ?? null;
  const amrHasTotp = (claims?.amr ?? []).some((entry) => entry?.method === "totp");
  if (aal === "aal2" || amrHasTotp) return;

  if (!(await hasVerifiedTotp(userId))) return;
  if (await hasRecentBackupCodeUse(userId)) return;

  throw new Error("İki adımlı doğrulama gerekli");
}

/**
 * Hesap silinmeden önce çağrılır: sipariş kayıtları (muhasebe/işletme geçmişi
 * için) saklanır, yalnızca siparişin taşıdığı kişisel veriler (ad, telefon,
 * adres, not) anonimleştirilir. orders.user_id FK'si ON DELETE SET NULL
 * olduğu için asıl silme işlemi (auth.admin.deleteUser) artık bu satırları
 * kaskadla yok etmez.
 */
export async function anonymizeUserOrders(userId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("orders")
    .update({
      recipient_name: "Silinmiş kullanıcı",
      phone: "",
      street: "",
      district: "",
      city: "",
      directions: null,
      note: null,
    })
    .eq("user_id", userId);
}

type BusinessVendorInput = {
  restaurantId: string;
  businessName: string;
  /** Yetkilinin kişisel ad soyadı — profiles.full_name'e yazılır. */
  ownerName: string;
  email: string;
  phone: string;
};

export type BusinessVendorResult = {
  userId: string;
  created: boolean;
  verificationSent: boolean;
  emailVerified: boolean;
};

async function rollbackNewVendorUser(userId: string, email: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("vendor_assignments").delete().eq("user_id", userId);
  await supabaseAdmin.from("user_roles").delete().eq("user_id", userId).eq("role", "vendor");
  await supabaseAdmin.from("profiles").delete().eq("id", userId);
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) {
    console.error("[vendor-signup] yarım hesap silinemedi", { message: error.message });
  }
  const { clearGuard } = await import("./otp.server");
  await clearGuard(email);
}

async function sendVendorSignupCode(email: string): Promise<void> {
  const { sendSixDigitOtp, hashEmail, EMAIL_SEND_FAILED_MESSAGE } = await import("./otp.server");
  const sent = await sendSixDigitOtp(email, "signup");
  if (sent.ok) return;
  console.error("[vendor-signup] doğrulama e-postası gönderilemedi", {
    emailHash: hashEmail(email),
    message: sent.error,
    retryAfterSeconds: sent.retryAfterSeconds ?? null,
  });
  throw new Error(EMAIL_SEND_FAILED_MESSAGE);
}

/**
 * İşletme iletişim e-postasını mevcut müşteri hesabıyla birleştirir; hesap yoksa
 * doğrulanmamış hesap oluşturur, 6 haneli kod gönderir ve işletmeye atar.
 */
export async function ensureBusinessVendorAccount(
  input: BusinessVendorInput,
): Promise<BusinessVendorResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { normalizePhone } = await import("./vendor-auth.server");
  const { isEmailVerified } = await import("./otp.server");
  const email = input.email.trim().toLowerCase();
  const phone = normalizePhone(input.phone);
  const ownerName = input.ownerName.trim();

  const { data: currentAssignment, error: currentAssignmentError } = await supabaseAdmin
    .from("vendor_assignments")
    .select("user_id")
    .eq("restaurant_id", input.restaurantId)
    .maybeSingle();
  if (currentAssignmentError) throw new Error(currentAssignmentError.message);
  let previousVendorUserId: string | null = null;
  if (currentAssignment) {
    const { data: currentUser } = await supabaseAdmin.auth.admin.getUserById(
      currentAssignment.user_id,
    );
    if (currentUser.user?.email?.trim().toLowerCase() === email) {
      // full_name artık işletme adı değil, yetkilinin kişisel ad soyadıdır;
      // bu yüzden güvenle yazılabilir (bkz. reviews.functions.ts yorum yazarı adı).
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .upsert(
          { id: currentAssignment.user_id, phone, full_name: ownerName },
          { onConflict: "id" },
        );
      if (profileError) throw new Error(profileError.message);
      const emailVerified = await isEmailVerified(currentAssignment.user_id);
      let verificationSent = false;
      if (!emailVerified) {
        await sendVendorSignupCode(email);
        verificationSent = true;
      }
      return {
        userId: currentAssignment.user_id,
        created: false,
        verificationSent,
        emailVerified,
      };
    }
    previousVendorUserId = currentAssignment.user_id;
  }

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

  let created = false;
  if (!matchedUserId) {
    const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: false,
      // Kişisel ad soyad: işletme adı restaurants.name'de tutulur.
      user_metadata: { full_name: ownerName, phone, business_name: input.businessName },
    });
    if (createError) throw new Error(createError.message);
    matchedUserId = createdUser.user?.id ?? null;
    created = true;
  }
  if (!matchedUserId) throw new Error("İşletme hesabı oluşturulamadı");

  const { data: otherAssignment, error: otherAssignmentError } = await supabaseAdmin
    .from("vendor_assignments")
    .select("restaurant_id")
    .eq("user_id", matchedUserId)
    .maybeSingle();
  if (otherAssignmentError) {
    if (created) await rollbackNewVendorUser(matchedUserId, email);
    throw new Error(otherAssignmentError.message);
  }
  if (otherAssignment && otherAssignment.restaurant_id !== input.restaurantId) {
    if (created) await rollbackNewVendorUser(matchedUserId, email);
    throw new Error("Bu e-posta başka bir işletme hesabına atanmış");
  }

  const emailVerified = await isEmailVerified(matchedUserId);
  let verificationSent = false;
  if (!emailVerified) {
    try {
      await sendVendorSignupCode(email);
      verificationSent = true;
    } catch (error) {
      if (created) await rollbackNewVendorUser(matchedUserId, email);
      throw error;
    }
  }

  if (previousVendorUserId && previousVendorUserId !== matchedUserId) {
    const { error: revokeAssignmentError } = await supabaseAdmin
      .from("vendor_assignments")
      .delete()
      .eq("restaurant_id", input.restaurantId)
      .eq("user_id", previousVendorUserId);
    if (revokeAssignmentError) throw new Error(revokeAssignmentError.message);
    const { error: revokeRoleError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", previousVendorUserId)
      .eq("role", "vendor");
    if (revokeRoleError) throw new Error(revokeRoleError.message);
  }

  // full_name = yetkilinin kişisel ad soyadı (işletme adı değil), bu yüzden yazılır.
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .upsert({ id: matchedUserId, phone, full_name: ownerName }, { onConflict: "id" });
  if (profileError) throw new Error(profileError.message);

  const { error: roleError } = await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: matchedUserId, role: "vendor" }, { onConflict: "user_id,role" });
  if (roleError) throw new Error(roleError.message);

  const { error: assignmentError } = await supabaseAdmin
    .from("vendor_assignments")
    .upsert(
      { user_id: matchedUserId, restaurant_id: input.restaurantId },
      { onConflict: "user_id" },
    );
  if (assignmentError) throw new Error(assignmentError.message);

  return { userId: matchedUserId, created, verificationSent, emailVerified };
}

/* ------------------------------------------------------------------ *
 * Bölgesel sayfa yöneticiliği
 * ------------------------------------------------------------------ */

export type PanelRegion = { city: string; district: string };

export type PanelAccess = {
  /** Ana hesap sahibi (founder). Tüm panel yetkilerine sahiptir. */
  isOwner: boolean;
  /** Bölge yöneticisinin yetkili olduğu şehir/ilçe çiftleri. Sahip için boştur. */
  regions: PanelRegion[];
};

function normalizeRegionPart(value: string | null | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase("tr");
}

/** Kullanıcının aktif bölge yöneticiliği yetkileri. */
export async function listPageManagerRegions(userId: string): Promise<PanelRegion[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("page_manager_roles")
    .select("city, district")
    .eq("user_id", userId)
    .eq("is_active", true);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({ city: row.city, district: row.district }));
}

/**
 * Panel erişimi: sahip için mevcut kurucu kontrolleri (e-posta + 2FA) aynen
 * uygulanır; bölge yöneticisi için doğrulanmış e-posta ve en az bir aktif
 * bölge yetkisi zorunludur. Yetkisiz istek "Forbidden" ile reddedilir.
 */
export async function assertPanelAccess(
  supabase: SupabaseClient<Database>,
  userId: string,
  claims: JwtClaims,
): Promise<PanelAccess> {
  if (await isFounderUser(supabase, userId)) {
    await assertFounder(supabase, userId, claims);
    return { isOwner: true, regions: [] };
  }
  const { assertVerifiedEmail } = await import("./otp.server");
  await assertVerifiedEmail(userId);
  const regions = await listPageManagerRegions(userId);
  if (regions.length === 0) throw new Error("Forbidden");
  return { isOwner: false, regions };
}

/** Verilen şehir/ilçe, erişim kapsamında mı? */
export function accessAllowsRegion(
  access: PanelAccess,
  city: string | null | undefined,
  district: string | null | undefined,
): boolean {
  if (access.isOwner) return true;
  const targetCity = normalizeRegionPart(city);
  const targetDistrict = normalizeRegionPart(district);
  if (!targetCity || !targetDistrict) return false;
  return access.regions.some(
    (region) =>
      normalizeRegionPart(region.city) === targetCity &&
      normalizeRegionPart(region.district) === targetDistrict,
  );
}

export function assertRegionAllowed(
  access: PanelAccess,
  city: string | null | undefined,
  district: string | null | undefined,
): void {
  if (!accessAllowsRegion(access, city, district)) throw new Error("Forbidden");
}

/** İşletmenin bölgesi erişim kapsamında mı? */
export async function assertRestaurantInScope(
  access: PanelAccess,
  restaurantId: string,
): Promise<void> {
  if (access.isOwner) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("restaurants")
    .select("city, district")
    .eq("id", restaurantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("İşletme bulunamadı");
  assertRegionAllowed(access, data.city, data.district);
}

/** Siparişin bağlı olduğu işletmenin bölgesi erişim kapsamında mı? */
export async function assertOrderInScope(access: PanelAccess, orderId: string): Promise<void> {
  if (access.isOwner) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("restaurant_id")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Sipariş bulunamadı");
  await assertRestaurantInScope(access, data.restaurant_id);
}

/** Menü kategorisi/ürünü hangi işletmeye ait, o işletme kapsamda mı? */
export async function assertMenuRowInScope(
  access: PanelAccess,
  table: "menu_categories" | "menu_items",
  rowId: string,
): Promise<void> {
  if (access.isOwner) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from(table)
    .select("restaurant_id")
    .eq("id", rowId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Kayıt bulunamadı");
  await assertRestaurantInScope(access, data.restaurant_id);
}

/** Hedef kullanıcı ana hesap sahibi mi? (sahip kimliğini koruma kontrolü) */
export async function isOwnerAccount(userId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "founder")
    .limit(1);
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}
