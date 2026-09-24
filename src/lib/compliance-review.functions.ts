import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runServerFn } from "./public-error";
import { businessPublishBlockers } from "./compliance";

/** İşletme belge türleri (etiketleri arayüzde gösterilir). */
export const BUSINESS_DOC_KINDS = {
  tax_certificate: "Vergi levhası",
  food_registration: "Gıda işletme kayıt/onay belgesi",
  trade_registry: "Ticaret sicil / esnaf sicil kaydı",
  signature_circular: "İmza sirküleri / beyannamesi",
  identity: "Yetkili kimlik belgesi",
  other: "Diğer",
} as const;
export type BusinessDocKind = keyof typeof BUSINESS_DOC_KINDS;
const docKind = z.enum(Object.keys(BUSINESS_DOC_KINDS) as [BusinessDocKind, ...BusinessDocKind[]]);
const note = z.string().trim().max(1000).nullable();

async function founderGuard(context: { supabase: never; userId: string; claims: unknown }) {
  const { assertFounder } = await import("./founder.server");
  await assertFounder(context.supabase, context.userId, context.claims as never);
}

async function requiredDocKinds(): Promise<string[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("compliance_settings")
    .select("value")
    .eq("key", "required_business_documents")
    .maybeSingle();
  return Array.isArray(data?.value) ? (data.value as string[]) : [];
}

/** Zorunlu belgelerin tamamı onaylı ve süresi geçmemişse işletmeyi doğrulanmış yapar. */
async function refreshVerification(restaurantId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [required, { data: docs }] = await Promise.all([
    requiredDocKinds(),
    supabaseAdmin
      .from("business_documents")
      .select("doc_kind, status, expires_at")
      .eq("restaurant_id", restaurantId),
  ]);
  const blockers = businessPublishBlockers(required, docs ?? []);
  const status = blockers.length === 0 ? "verified" : "pending";
  await supabaseAdmin
    .from("restaurants")
    .update({
      verification_status: status,
      verification_note: blockers.length ? `Eksik: ${blockers.join(", ")}` : null,
    })
    .eq("id", restaurantId);
  return { status, blockers };
}

// ---------------- İşletme tarafı ----------------

export const submitBusinessDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        docKind,
        storagePath: z.string().trim().min(3).max(300),
        documentNo: z.string().trim().max(80).nullable(),
        expiresAt: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      const { assertVendor } = await import("./vendor.server");
      const restaurantId = await assertVendor(context.supabase, context.userId);
      if (!data.storagePath.startsWith(`${restaurantId}/`) || data.storagePath.includes("..")) {
        throw new Error("Belge yolu geçersiz.");
      }
      const { error } = await context.supabase.from("business_documents").insert({
        restaurant_id: restaurantId,
        doc_kind: data.docKind,
        storage_path: data.storagePath,
        document_no: data.documentNo,
        expires_at: data.expiresAt,
        status: "submitted",
      });
      if (error) throw new Error(error.message);
      return { ok: true };
    }),
  );

export const listMyBusinessDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    runServerFn(async () => {
      const { assertVendor } = await import("./vendor.server");
      const restaurantId = await assertVendor(context.supabase, context.userId);
      const { data } = await context.supabase
        .from("business_documents")
        .select("id, doc_kind, document_no, expires_at, status, review_note, created_at")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false });
      return { restaurantId, required: await requiredDocKinds(), documents: data ?? [] };
    }),
  );

export const replyToReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ reviewId: z.string().uuid(), reply: z.string().trim().min(2).max(600) })
      .parse(input),
  )
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      const { assertVendor } = await import("./vendor.server");
      const restaurantId = await assertVendor(context.supabase, context.userId);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: row, error } = await supabaseAdmin
        .from("reviews")
        .update({ seller_reply: data.reply, seller_reply_at: new Date().toISOString() })
        .eq("id", data.reviewId)
        .eq("restaurant_id", restaurantId)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!row) throw new Error("Yorum bulunamadı.");
      const { logAudit } = await import("./audit.server");
      await logAudit({
        actorId: context.userId,
        action: "review.seller_reply",
        entity: "reviews",
        entityId: data.reviewId,
        detail: {},
      });
      return { ok: true };
    }),
  );

/** Belgeyi görüntülemek için kısa süreli bağlantı (depo kuralları erişimi denetler). */
export const getBusinessDocumentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      const { data: doc } = await context.supabase
        .from("business_documents")
        .select("storage_path")
        .eq("id", data.id)
        .maybeSingle();
      if (!doc?.storage_path) throw new Error("Belge bulunamadı.");
      const { data: signed, error } = await context.supabase.storage
        .from("business-documents")
        .createSignedUrl(doc.storage_path, 120);
      if (error || !signed) throw new Error("Belge açılamadı.");
      return { url: signed.signedUrl };
    }),
  );

// ---------------- Kurucu tarafı ----------------

export const getReviewQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    runServerFn(async () => {
      await founderGuard(context as never);
      const s = context.supabase;
      const [docs, complaints, refunds, reports, incidents] = await Promise.all([
        s
          .from("business_documents")
          .select(
            "id, restaurant_id, doc_kind, document_no, expires_at, status, created_at, restaurants(name)",
          )
          .eq("status", "submitted")
          .order("created_at"),
        s
          .from("complaints")
          .select("id, subject, body, status, created_at, restaurant_id, restaurants(name)")
          .not("status", "in", "(RESOLVED,REJECTED,REFUNDED)")
          .order("created_at"),
        s
          .from("refund_requests")
          .select("id, reason, requested_amount, status, created_at, order_id, restaurants(name)")
          .in("status", ["open", "seller_review", "platform_review"])
          .order("created_at"),
        s
          .from("content_reports")
          .select("id, target_type, target_id, reason, details, created_at")
          .eq("status", "open")
          .order("created_at"),
        s
          .from("security_incidents")
          .select("id, affected_system, status, detected_at, affected_count_estimate")
          .order("detected_at", { ascending: false })
          .limit(20),
      ]);
      return {
        documents: docs.data ?? [],
        complaints: complaints.data ?? [],
        refunds: refunds.data ?? [],
        reports: reports.data ?? [],
        incidents: incidents.data ?? [],
      };
    }),
  );

export const decideBusinessDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ id: z.string().uuid(), decision: z.enum(["approved", "rejected"]), note })
      .parse(input),
  )
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      await founderGuard(context as never);
      if (data.decision === "rejected" && !data.note) throw new Error("Red gerekçesi zorunlu.");
      const { data: doc, error } = await context.supabase
        .from("business_documents")
        .update({
          status: data.decision,
          review_note: data.note,
          reviewed_by: context.userId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", data.id)
        .eq("status", "submitted")
        .select("restaurant_id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!doc) throw new Error("Belge zaten işlenmiş.");
      return { ok: true, verification: await refreshVerification(doc.restaurant_id) };
    }),
  );

export const decideComplaint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["SELLER_RESPONSE", "PLATFORM_REVIEW", "RESOLVED", "REJECTED", "ESCALATED"]),
        message: z.string().trim().min(3).max(1000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      await founderGuard(context as never);
      const { error } = await context.supabase
        .from("complaints")
        .update({ status: data.status })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("complaint_events").insert({
        complaint_id: data.id,
        actor_id: context.userId,
        actor_role: "founder",
        message: data.message,
        new_status: data.status,
      });
      return { ok: true };
    }),
  );

export const decideRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum([
          "seller_review",
          "platform_review",
          "approved",
          "partially_approved",
          "rejected",
        ]),
        note: z.string().trim().min(3).max(1000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      await founderGuard(context as never);
      const final = ["approved", "partially_approved", "rejected"].includes(data.status);
      const { error } = await context.supabase
        .from("refund_requests")
        .update({
          status: data.status,
          decision_note: data.note,
          ...(final ? { decided_by: context.userId, decided_at: new Date().toISOString() } : {}),
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }),
  );

export const decideContentReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        decision: z.enum(["removed", "dismissed"]),
        reason: z.string().trim().min(3).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      await founderGuard(context as never);
      const { data: report, error } = await context.supabase
        .from("content_reports")
        .update({
          status: data.decision,
          decision_reason: data.reason,
          decided_by: context.userId,
          decided_at: new Date().toISOString(),
        })
        .eq("id", data.id)
        .eq("status", "open")
        .select("target_type, target_id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!report) throw new Error("Rapor zaten işlenmiş.");
      if (data.decision === "removed" && report.target_type === "review") {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin
          .from("reviews")
          .update({ is_hidden: true, hidden_reason: data.reason })
          .eq("id", report.target_id);
      }
      return { ok: true };
    }),
  );

export const createSecurityIncident = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        affectedSystem: z.string().trim().min(2).max(200),
        dataCategories: z.array(z.string().trim().min(1).max(60)).max(20),
        affectedCountEstimate: z.number().int().min(0).nullable(),
        occurredAt: z.string().max(40).nullable(),
        measures: z.string().trim().max(2000).nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      await founderGuard(context as never);
      const { error } = await context.supabase.from("security_incidents").insert({
        affected_system: data.affectedSystem,
        data_categories: data.dataCategories,
        affected_count_estimate: data.affectedCountEstimate,
        occurred_at: data.occurredAt ? new Date(data.occurredAt).toISOString() : null,
        measures: data.measures,
        responsible_admin: context.userId,
      });
      if (error) throw new Error(error.message);
      return { ok: true };
    }),
  );

export const updateSecurityIncident = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["open", "contained", "closed"]),
        notificationAssessment: z.string().trim().max(2000).nullable(),
        authorityNotified: z.boolean(),
        subjectsNotified: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      await founderGuard(context as never);
      const now = new Date().toISOString();
      const { error } = await context.supabase
        .from("security_incidents")
        .update({
          status: data.status,
          notification_assessment: data.notificationAssessment,
          ...(data.authorityNotified ? { authority_notified_at: now } : {}),
          ...(data.subjectsNotified ? { subjects_notified_at: now } : {}),
          ...(data.status === "closed" ? { closed_at: now } : {}),
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }),
  );
