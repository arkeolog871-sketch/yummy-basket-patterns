import * as React from "react";
import { render } from "@react-email/render";
import { sendLovableEmail } from "@lovable.dev/email-js";
import { NewOrderEmail } from "@/lib/email-templates/new-order";
import { formatDateTime, formatPrice } from "@/lib/format";

const SITE_NAME = "SİLVAN CEBİMDE";
const SENDER_DOMAIN = "notify.uygulamamcebimde.online";
const ROOT_DOMAIN = "uygulamamcebimde.online";
const SITE_URL = `https://${ROOT_DOMAIN}`;
const DASHBOARD_URL = `${SITE_URL}/vendor/dashboard`;

type AlertChannel = "in_app" | "email";

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isMissingRelationError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return /does not exist|schema cache/i.test(error.message ?? "");
}

function isUniqueViolation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "23505" || /duplicate key|unique constraint/i.test(error.message ?? "");
}

function joinAddress(parts: Array<string | null | undefined>): string {
  return parts.map((part) => (part ?? "").trim()).filter(Boolean).join(", ");
}

/** Sipariş kaydından sonra işletmeye in-app + e-posta. Hata siparişi geri almaz. */
export async function notifyVendorOfNewOrder(orderId: string): Promise<void> {
  try {
    await notifyVendorOfNewOrderUnsafe(orderId);
  } catch (error) {
    console.error("[order-vendor-alert] bildirim tamamlanamadı", {
      orderId,
      code: error && typeof error === "object" && "code" in error ? error.code : undefined,
    });
  }
}

async function notifyVendorOfNewOrderUnsafe(orderId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select(
      "id, restaurant_id, created_at, recipient_name, phone, street, district, city, directions, note, subtotal, delivery_fee, total, order_items(name, quantity, unit_price)",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (orderError) throw orderError;
  if (!order) return;

  const { data: restaurant, error: restaurantError } = await supabaseAdmin
    .from("restaurants")
    .select("id, name, contact_email")
    .eq("id", order.restaurant_id)
    .maybeSingle();
  if (restaurantError) throw restaurantError;
  if (!restaurant) return;

  const lines = (order.order_items ?? []).map((line) => ({
    name: line.name,
    quantity: Number(line.quantity),
    unitPriceLabel: formatPrice(Number(line.unit_price)),
    lineTotalLabel: formatPrice(Number(line.unit_price) * Number(line.quantity)),
  }));
  const address = joinAddress([order.street, order.district, order.city, order.directions]);
  const totalLabel = formatPrice(Number(order.total));
  const title = "Yeni sipariş";
  const body = `${restaurant.name} · ${totalLabel} · ${order.recipient_name}`;

  await deliverInAppAlert({
    orderId: order.id,
    restaurantId: restaurant.id,
    title,
    body,
  });

  const to = (restaurant.contact_email ?? "").trim().toLowerCase();
  if (!looksLikeEmail(to)) return;

  await deliverOrderEmail({
    orderId: order.id,
    restaurantId: restaurant.id,
    title,
    body,
    to,
    restaurantName: restaurant.name,
    createdAtLabel: formatDateTime(order.created_at),
    recipientName: order.recipient_name,
    phone: order.phone,
    address,
    note: order.note,
    lines,
    subtotalLabel: formatPrice(Number(order.subtotal)),
    deliveryFeeLabel: formatPrice(Number(order.delivery_fee)),
    totalLabel,
    paymentLabel: "Kapıda ödeme",
  });
}

async function deliverInAppAlert(input: {
  orderId: string;
  restaurantId: string;
  title: string;
  body: string;
}): Promise<void> {
  const claimed = await claimAlert({ ...input, channel: "in_app", markSent: true });
  if (claimed === "missing_table") {
    console.error("[order-vendor-alert] order_vendor_alerts tablosu yok, in-app atlandı", {
      orderId: input.orderId,
    });
  }
}

async function deliverOrderEmail(input: {
  orderId: string;
  restaurantId: string;
  title: string;
  body: string;
  to: string;
  restaurantName: string;
  createdAtLabel: string;
  recipientName: string;
  phone: string;
  address: string;
  note: string | null;
  lines: Array<{
    name: string;
    quantity: number;
    unitPriceLabel: string;
    lineTotalLabel: string;
  }>;
  subtotalLabel: string;
  deliveryFeeLabel: string;
  totalLabel: string;
  paymentLabel: string;
}): Promise<void> {
  const claimed = await claimAlert({
    orderId: input.orderId,
    restaurantId: input.restaurantId,
    channel: "email",
    title: input.title,
    body: input.body,
    markSent: false,
  });
  if (claimed === "already_sent" || claimed === "missing_table") return;

  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) {
    console.error("[order-vendor-alert] LOVABLE_API_KEY eksik, işletme e-postası gönderilemedi", {
      orderId: input.orderId,
    });
    return;
  }

  const element = React.createElement(NewOrderEmail, {
    siteName: SITE_NAME,
    restaurantName: input.restaurantName,
    dashboardUrl: DASHBOARD_URL,
    createdAtLabel: input.createdAtLabel,
    recipientName: input.recipientName,
    phone: input.phone,
    address: input.address,
    note: input.note,
    lines: input.lines,
    subtotalLabel: input.subtotalLabel,
    deliveryFeeLabel: input.deliveryFeeLabel,
    totalLabel: input.totalLabel,
    paymentLabel: input.paymentLabel,
  });
  const html = await render(element);
  const text = await render(element, { plainText: true });
  const subject = `${SITE_NAME}: yeni sipariş — ${input.totalLabel}`;
  const idempotencyKey = `vendor-new-order-${input.orderId}`;

  let sent = false;
  for (const domain of [SENDER_DOMAIN, ROOT_DOMAIN]) {
    try {
      const result = await sendLovableEmail(
        {
          to: input.to,
          from: `${SITE_NAME} <noreply@${domain}>`,
          sender_domain: domain,
          subject,
          html,
          text,
          purpose: "transactional",
          idempotency_key: idempotencyKey,
        },
        { apiKey, sendUrl: process.env["LOVABLE_SEND_URL"] },
      );
      if (result.success) {
        sent = true;
        break;
      }
    } catch {
      console.error("[order-vendor-alert] işletme e-postası gönderilemedi", {
        orderId: input.orderId,
        senderDomain: domain,
      });
    }
  }

  if (!sent) {
    console.error("[order-vendor-alert] işletme e-postası gitmedi", { orderId: input.orderId });
    return;
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("order_vendor_alerts")
    .update({ sent_at: new Date().toISOString() })
    .eq("order_id", input.orderId)
    .eq("channel", "email")
    .is("sent_at", null);
}

async function claimAlert(input: {
  orderId: string;
  restaurantId: string;
  channel: AlertChannel;
  title: string;
  body: string;
  markSent: boolean;
}): Promise<"claimed" | "already_sent" | "missing_table"> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date().toISOString();
  const inserted = await supabaseAdmin
    .from("order_vendor_alerts")
    .insert({
      order_id: input.orderId,
      restaurant_id: input.restaurantId,
      channel: input.channel,
      title: input.title,
      body: input.body,
      sent_at: input.markSent ? now : null,
    })
    .select("id, sent_at")
    .maybeSingle();

  if (!inserted.error) return input.markSent ? "already_sent" : "claimed";
  if (isMissingRelationError(inserted.error)) return "missing_table";
  if (!isUniqueViolation(inserted.error)) throw inserted.error;

  const existing = await supabaseAdmin
    .from("order_vendor_alerts")
    .select("id, sent_at")
    .eq("order_id", input.orderId)
    .eq("channel", input.channel)
    .maybeSingle();
  if (existing.error) {
    if (isMissingRelationError(existing.error)) return "missing_table";
    throw existing.error;
  }
  if (input.markSent || existing.data?.sent_at) return "already_sent";
  return "claimed";
}

export const __orderVendorAlertTest = {
  looksLikeEmail,
  isMissingRelationError,
  isUniqueViolation,
};
