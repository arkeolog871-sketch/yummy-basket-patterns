type ApplicationAlertInput = {
  applicantUserId: string | null;
  businessName: string;
  approved: boolean;
  contactEmail?: string | null;
  founderNote?: string | null;
};

/**
 * Başvuru onaylandığında/reddedildiğinde başvurana push bildirimi gönderir.
 * Sipariş durum bildirimiyle aynı desen: inceleme akışını asla bozmaz, hata yutulur.
 */
export async function notifyApplicantOfApplicationReview(
  input: ApplicationAlertInput,
): Promise<void> {
  if (!input.applicantUserId) return;
  try {
    const { sendPushToUserIds } = await import("./push.server");
    const title = input.approved ? "İşletme başvurunuz onaylandı" : "İşletme başvurunuz reddedildi";
    const body = input.approved
      ? `${input.businessName} yayına hazırlanıyor. İşletmenizi şu e-posta ile yönetebilirsiniz: ${
          input.contactEmail ?? "-"
        }`
      : `${input.businessName} başvurunuz reddedildi.${
          input.founderNote ? ` Not: ${input.founderNote}` : ""
        }`;
    await sendPushToUserIds([input.applicantUserId], {
      title,
      body,
      url: "/isletme-basvuru",
    });
  } catch (error) {
    console.error("[business-application-alert] push bildirimi başarısız", {
      code: error && typeof error === "object" && "code" in error ? error.code : undefined,
    });
  }
}

/**
 * Yeni bir işletme başvurusu geldiğinde kurucuya (ve admin rolündekilere) ve
 * başvurunun şehir/ilçesine yetkili sayfa yöneticilerine push bildirimi
 * gönderir. Bölge yöneticisi yalnızca kendi bölgesine düşen başvuruyu panelde
 * zaten görebiliyor (bkz. `accessAllowsRegion`); bildirim de aynı kapsamla
 * sınırlı — görmediği bir başvuru için bildirim almaz.
 *
 * Başvuru zaten kaydedildi; push başarısız olsa da başvuru akışını bozmaz.
 */
export async function notifyFoundersOfNewApplication(input: {
  businessName: string;
  city: string | null;
  district: string | null;
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { normalizeRegionPart } = await import("./founder.server");

    const [foundersResult, pageManagersResult] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id").in("role", ["founder", "admin"]),
      supabaseAdmin
        .from("page_manager_roles")
        .select("user_id, city, district")
        .eq("is_active", true),
    ]);

    const founderIds = (foundersResult.data ?? []).map((row) => row.user_id);
    const targetCity = normalizeRegionPart(input.city);
    const targetDistrict = normalizeRegionPart(input.district);
    const pageManagerIds =
      targetCity && targetDistrict
        ? (pageManagersResult.data ?? [])
            .filter(
              (row) =>
                normalizeRegionPart(row.city) === targetCity &&
                normalizeRegionPart(row.district) === targetDistrict,
            )
            .map((row) => row.user_id)
        : [];

    const userIds = [...new Set([...founderIds, ...pageManagerIds])];
    if (userIds.length === 0) return;

    const { sendPushToUserIds } = await import("./push.server");
    await sendPushToUserIds(userIds, {
      title: "Yeni işletme başvurusu",
      body: `${input.businessName} başvuru gönderdi.`,
      url: "/kurucu",
    });
  } catch (error) {
    console.error("[business-application-alert] push bildirimi başarısız (yeni başvuru)", {
      code: error && typeof error === "object" && "code" in error ? error.code : undefined,
    });
  }
}
