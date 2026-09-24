import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runServerFn } from "./public-error";
import { LEGAL_VERSIONS } from "./legal";
import { identityMissingFields, type PlatformIdentity } from "./compliance";

const channel = z.enum(["sms", "email", "push", "call"]);

/** Herkese açık platform kimliği + yayına hazırlık durumu. */
export const getPlatformIdentity = createServerFn({ method: "GET" }).handler(async () =>
  runServerFn(async () => {
    // Yasal olarak herkese açık olması gereken kimlik alanları; tablo doğrudan
    // okunamaz, yalnız bu sabit sütun listesi sunucudan döner.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("platform_identity")
      .select(
        "legal_name, brand_name, mersis_no, tax_office, tax_no, address, phone, email, kep_address, kvkk_contact, authorized_person",
      )
      .eq("id", "default")
      .maybeSingle();
    const identity = (data ?? {}) as PlatformIdentity;
    return { identity, missing: identityMissingFields(identity) };
  }),
);

export const updatePlatformIdentity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        legal_name: z.string().trim().max(200).nullable(),
        brand_name: z.string().trim().max(120).nullable(),
        mersis_no: z.string().trim().max(32).nullable(),
        tax_office: z.string().trim().max(120).nullable(),
        tax_no: z.string().trim().max(20).nullable(),
        address: z.string().trim().max(400).nullable(),
        phone: z.string().trim().max(40).nullable(),
        email: z.string().trim().max(200).nullable(),
        kep_address: z.string().trim().max(200).nullable(),
        kvkk_contact: z.string().trim().max(400).nullable(),
        authorized_person: z.string().trim().max(200).nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      const { assertFounder } = await import("./founder.server");
      await assertFounder(context.supabase, context.userId, context.claims as never);
      const { error } = await context.supabase
        .from("platform_identity")
        .upsert({ id: "default", ...data });
      if (error) throw new Error(error.message);
      const { logAudit } = await import("./audit.server");
      await logAudit({
        actorId: context.userId,
        action: "platform_identity.update",
        entity: "platform_identity",
        entityId: "default",
        detail: { fields: Object.keys(data) },
      });
      return { ok: true };
    }),
  );

/** Kullanıcının kanal bazında son pazarlama izni. */
export const getMyMarketingConsents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    runServerFn(async () => {
      const { data, error } = await context.supabase
        .from("communication_consents")
        .select("channel, granted, created_at")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      const latest: Record<string, boolean> = { sms: false, email: false, push: false };
      const seen = new Set<string>();
      for (const row of data ?? []) {
        if (seen.has(row.channel)) continue;
        seen.add(row.channel);
        latest[row.channel] = row.granted;
      }
      return { consents: latest, history: data ?? [] };
    }),
  );

export const setMarketingConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ channel, granted: z.boolean(), source: z.string().max(40).default("account") })
      .parse(input),
  )
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      const { error } = await context.supabase.from("communication_consents").insert({
        user_id: context.userId,
        channel: data.channel,
        granted: data.granted,
        source: data.source,
      });
      if (error) throw new Error(error.message);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { hashedRequestIp } = await import("./legal-audit.server");
      await supabaseAdmin.from("legal_acceptances").insert({
        user_id: context.userId,
        doc_type: "marketing",
        version: LEGAL_VERSIONS.marketing,
        acceptance_type: data.granted ? "marketing_opt_in" : "marketing_opt_out",
        context: `${data.source}:${data.channel}`,
        ...(await hashedRequestIp()),
      });
      return { ok: true };
    }),
  );

export const createComplaint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        orderId: z.string().uuid().nullable(),
        subject: z.string().trim().min(3).max(120),
        body: z.string().trim().min(10).max(2000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      let restaurantId: string | null = null;
      if (data.orderId) {
        // RLS: kullanıcı yalnız kendi siparişini okuyabilir (IDOR koruması).
        const { data: order } = await context.supabase
          .from("orders")
          .select("id, restaurant_id")
          .eq("id", data.orderId)
          .eq("user_id", context.userId)
          .maybeSingle();
        if (!order) throw new Error("Sipariş bulunamadı.");
        restaurantId = order.restaurant_id;
      }
      const { supabaseAdmin: settingsAdmin } = await import(
        "@/integrations/supabase/client.server"
      );
      const { data: settings } = await settingsAdmin
        .from("compliance_settings")
        .select("key, value")
        .in("key", ["complaint_seller_hours", "complaint_platform_hours"]);
      const hours = (k: string, d: number) =>
        Number(settings?.find((s) => s.key === k)?.value ?? d) || d;
      const now = Date.now();
      const { data: row, error } = await context.supabase
        .from("complaints")
        .insert({
          user_id: context.userId,
          order_id: data.orderId,
          restaurant_id: restaurantId,
          subject: data.subject,
          body: data.body,
          seller_due_at: new Date(
            now + hours("complaint_seller_hours", 48) * 3600_000,
          ).toISOString(),
          platform_due_at: new Date(
            now + hours("complaint_platform_hours", 72) * 3600_000,
          ).toISOString(),
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      const { logAudit } = await import("./audit.server");
      await logAudit({
        actorId: context.userId,
        action: "complaint.create",
        entity: "complaints",
        entityId: row.id,
      });
      return { id: row.id };
    }),
  );

export const listMyComplaints = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    runServerFn(async () => {
      const { data, error } = await context.supabase
        .from("complaints")
        .select("id, subject, status, created_at, order_id, seller_due_at")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return data ?? [];
    }),
  );

export const createRefundRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        orderId: z.string().uuid(),
        orderItemId: z.string().uuid().nullable(),
        reason: z.string().trim().min(5).max(1000),
        amount: z.number().positive().max(100000).nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      const { data: order } = await context.supabase
        .from("orders")
        .select("id, restaurant_id, total")
        .eq("id", data.orderId)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (!order) throw new Error("Sipariş bulunamadı.");
      if (data.amount && data.amount > Number(order.total))
        throw new Error("İade tutarı sipariş toplamını aşamaz.");
      const { data: row, error } = await context.supabase
        .from("refund_requests")
        .insert({
          order_id: order.id,
          order_item_id: data.orderItemId,
          user_id: context.userId,
          restaurant_id: order.restaurant_id,
          reason: data.reason,
          requested_amount: data.amount,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      const { logAudit } = await import("./audit.server");
      await logAudit({
        actorId: context.userId,
        action: "refund.request",
        entity: "refund_requests",
        entityId: row.id,
        detail: { partial: Boolean(data.orderItemId || data.amount) },
      });
      return { id: row.id };
    }),
  );

export const reportContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        targetType: z.enum(["review", "menu_item", "restaurant", "advertisement"]),
        targetId: z.string().uuid(),
        reason: z.enum([
          "insult",
          "personal_data",
          "threat",
          "misleading",
          "illegal",
          "spam",
          "other",
        ]),
        details: z.string().trim().max(500).nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      const { error } = await context.supabase.from("content_reports").insert({
        reporter_id: context.userId,
        target_type: data.targetType,
        target_id: data.targetId,
        reason: data.reason,
        details: data.details,
      });
      if (error && error.code !== "23505") throw new Error(error.message);
      return { ok: true };
    }),
  );

const preInfoSchema = z.object({
  orderId: z.string().uuid(),
  snapshot: z.object({
    seller: z.record(z.string(), z.unknown()),
    items: z
      .array(
        z.object({ name: z.string().max(200), quantity: z.number().int(), unit_price: z.number() }),
      )
      .max(40),
    total: z.number(),
    delivery_fee: z.number(),
    payment_method: z.string().max(40),
  }),
});

/**
 * Siparişe, onay anındaki ön bilgilendirmenin kalıcı kopyasını ve belge
 * sürümlerini ekler. Yalnız sipariş sahibi, yalnız bir kez yazabilir.
 */
export const attachPreInformation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => preInfoSchema.parse(input))
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      const { data: order } = await context.supabase
        .from("orders")
        .select("id, restaurant_id")
        .eq("id", data.orderId)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (!order) throw new Error("Sipariş bulunamadı.");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      // Satıcı ve platform bilgisi istemciden değil sunucudan alınır; işletme
      // profili sonradan değişse de bu kopya değişmez.
      const [{ data: seller }, { data: platform }] = await Promise.all([
        supabaseAdmin
          .from("restaurants")
          .select(
            "id, name, legal_name, legal_entity_type, tax_office, tax_no, mersis_no, address, district, city, contact_phone, contact_email",
          )
          .eq("id", order.restaurant_id)
          .maybeSingle(),
        supabaseAdmin
          .from("platform_identity")
          .select("legal_name, brand_name, address, phone, email, kep_address, mersis_no")
          .eq("id", "default")
          .maybeSingle(),
      ]);
      const { error: snapError } = await supabaseAdmin
        .from("orders")
        .update({
          pre_information: {
            ...data.snapshot,
            seller: seller ?? data.snapshot.seller,
            platform: platform ?? null,
            captured_at: new Date().toISOString(),
          } as never,
          seller_snapshot: (seller ?? null) as never,
          legal_versions: {
            terms: LEGAL_VERSIONS.terms,
            distance_sales: LEGAL_VERSIONS.distance_sales,
            cancellation: LEGAL_VERSIONS.cancellation,
            kvkk: LEGAL_VERSIONS.kvkk,
            package: "3.0",
          },
        })
        .eq("id", data.orderId)
        .is("pre_information", null);
      if (snapError) throw new Error(snapError.message);
      return { ok: true };
    }),
  );

/** İşletmenin güncel katılım sözleşmesi sürümünü kabulü. */
export const acceptVendorAgreement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    runServerFn(async () => {
      const { assertVendor } = await import("./vendor.server");
      const restaurantId = await assertVendor(context.supabase, context.userId);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const now = new Date().toISOString();
      await supabaseAdmin
        .from("restaurants")
        .update({ agreement_version: LEGAL_VERSIONS.vendor_agreement, agreement_accepted_at: now })
        .eq("id", restaurantId);
      const { hashedRequestIp } = await import("./legal-audit.server");
      await supabaseAdmin.from("legal_acceptances").insert({
        user_id: context.userId,
        doc_type: "vendor_agreement",
        version: LEGAL_VERSIONS.vendor_agreement,
        acceptance_type: "contract_accept",
        context: `restaurant:${restaurantId}`,
        ...(await hashedRequestIp()),
      });
      const { logAudit } = await import("./audit.server");
      await logAudit({
        actorId: context.userId,
        action: "vendor.agreement.accept",
        entity: "restaurants",
        entityId: restaurantId,
        detail: { version: LEGAL_VERSIONS.vendor_agreement },
      });
      return { ok: true, version: LEGAL_VERSIONS.vendor_agreement };
    }),
  );

export const getVendorCompliance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    runServerFn(async () => {
      const { assertVendor } = await import("./vendor.server");
      const restaurantId = await assertVendor(context.supabase, context.userId);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const [{ data: r }, { data: docs }, { data: fees }] = await Promise.all([
        supabaseAdmin
          .from("restaurants")
          .select("agreement_version, verification_status, verification_note, suspended_reason")
          .eq("id", restaurantId)
          .maybeSingle(),
        context.supabase
          .from("business_documents")
          .select("doc_kind, status, expires_at")
          .eq("restaurant_id", restaurantId),
        context.supabase
          .from("order_fee_lines")
          .select("fee_type, amount, created_at")
          .eq("restaurant_id", restaurantId)
          .order("created_at", { ascending: false })
          .limit(500),
      ]);
      return {
        currentAgreementVersion: LEGAL_VERSIONS.vendor_agreement,
        acceptedVersion: r?.agreement_version ?? null,
        verificationStatus: r?.verification_status ?? "pending",
        verificationNote: r?.verification_note ?? null,
        documents: docs ?? [],
        fees: fees ?? [],
      };
    }),
  );

/** Kurucu için Hukuk ve Uyum Merkezi özet listeleri. */
export const getComplianceOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    runServerFn(async () => {
      const { assertFounder } = await import("./founder.server");
      await assertFounder(context.supabase, context.userId, context.claims as never);
      const s = context.supabase;
      const today = new Date().toISOString().slice(0, 10);
      const [
        pendingVendors,
        docs,
        expired,
        complaints,
        refunds,
        reports,
        incidents,
        deletions,
        processors,
        restaurants,
        identity,
      ] = await Promise.all([
        s
          .from("restaurants")
          .select("id, name, verification_status")
          .neq("verification_status", "verified"),
        s
          .from("business_documents")
          .select("id, restaurant_id, doc_kind, status")
          .eq("status", "submitted"),
        s
          .from("business_documents")
          .select("id, restaurant_id, doc_kind, expires_at")
          .lt("expires_at", today),
        s
          .from("complaints")
          .select("id, subject, status, seller_due_at")
          .not("status", "in", "(RESOLVED,REJECTED,REFUNDED)"),
        s
          .from("refund_requests")
          .select("id, status, requested_amount, restaurant_id")
          .in("status", ["open", "seller_review", "platform_review"]),
        s.from("content_reports").select("id, target_type, reason").eq("status", "open"),
        s.from("security_incidents").select("id, affected_system, status").neq("status", "closed"),
        s
          .from("account_deletion_requests")
          .select("id, status, created_at")
          .eq("status", "pending"),
        s
          .from("data_processors")
          .select("id, name, transfer_status")
          .eq("transfer_status", "pending"),
        s.from("restaurants").select("id, name, agreement_version"),
        s.from("platform_identity").select("*").eq("id", "default").maybeSingle(),
      ]);
      const outdatedAgreements = (restaurants.data ?? []).filter(
        (r) => (r.agreement_version ?? 0) < LEGAL_VERSIONS.vendor_agreement,
      );
      return {
        identityMissing: identityMissingFields((identity.data ?? {}) as PlatformIdentity),
        pendingVendors: pendingVendors.data ?? [],
        pendingDocuments: docs.data ?? [],
        expiredDocuments: expired.data ?? [],
        openComplaints: complaints.data ?? [],
        openRefunds: refunds.data ?? [],
        openReports: reports.data ?? [],
        openIncidents: incidents.data ?? [],
        pendingDeletions: deletions.data ?? [],
        pendingTransfers: processors.data ?? [],
        outdatedAgreements,
      };
    }),
  );

/**
 * Satın almadan önce gösterilmesi gereken satıcı kimlik/iletişim bilgisi.
 * Yalnız açık işletme, yalnız müşteriye gösterilmesi zorunlu alanlar döner.
 */
export const getSellerDisclosure = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ restaurantId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) =>
    runServerFn(async () => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: r } = await supabaseAdmin
        .from("restaurants")
        .select(
          "name, legal_name, legal_entity_type, tax_office, mersis_no, address, district, city, contact_phone, contact_email, delivery_type, delivery_fee, min_order, opens_at, closes_at, sector",
        )
        .eq("id", data.restaurantId)
        .eq("is_active", true)
        .maybeSingle();
      if (!r) return null;
      return r;
    }),
  );
