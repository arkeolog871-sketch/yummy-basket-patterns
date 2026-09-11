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
