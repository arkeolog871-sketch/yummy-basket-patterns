import { ORDER_STATUS_LABELS } from "@/lib/format";

export type NotificationKind =
  | "order_new_vendor"
  | "order_status_customer"
  | "admin_broadcast"
  | "admin_restaurant"
  | "admin_user";

type CreateNotificationInput = {
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  dedupKey: string;
  orderId?: string | null;
  restaurantId?: string | null;
  route?: string | null;
};

type PushPayload = {
  title: string;
  body: string;
  route?: string | null;
};

function isUniqueViolation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "23505" || /duplicate key|unique constraint/i.test(error.message ?? "");
}

function isMissingRelationError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return /does not exist|schema cache/i.test(error.message ?? "");
}

/** Bildirim + push; hata fırlatmaz, sipariş akışını kesmez. */
export async function deliverUserNotification(input: CreateNotificationInput): Promise<void> {
  try {
    const created = await insertNotification(input);
    if (!created) return;
    void sendPushToUsers([input.userId], {
      title: input.title,
      body: input.body,
      route: input.route ?? null,
    }).catch((error) => {
      console.error("[notifications] push dispatch failed", {
        kind: input.kind,
        userId: input.userId,
      });
      void error;
    });
  } catch (error) {
    console.error("[notifications] deliver failed", {
      kind: input.kind,
      userId: input.userId,
      code: error && typeof error === "object" && "code" in error ? error.code : undefined,
    });
  }
}

async function insertNotification(input: CreateNotificationInput): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("user_notifications").insert({
    user_id: input.userId,
    kind: input.kind,
    title: input.title,
    body: input.body,
    dedup_key: input.dedupKey,
    order_id: input.orderId ?? null,
    restaurant_id: input.restaurantId ?? null,
    route: input.route ?? null,
  });
  if (!error) return true;
  if (isUniqueViolation(error)) return false;
  if (isMissingRelationError(error)) {
    console.error("[notifications] user_notifications tablosu yok");
    return false;
  }
  throw error;
}

export async function notifyVendorUsersOfNewOrder(input: {
  orderId: string;
  restaurantId: string;
  title: string;
  body: string;
}): Promise<void> {
  const userIds = await vendorUserIdsForRestaurant(input.restaurantId);
  await Promise.all(
    userIds.map((userId) =>
      deliverUserNotification({
        userId,
        kind: "order_new_vendor",
        title: input.title,
        body: input.body,
        orderId: input.orderId,
        restaurantId: input.restaurantId,
        route: "/vendor/dashboard",
        dedupKey: `order-new-vendor:${input.orderId}:${userId}`,
      }),
    ),
  );
}

export async function notifyCustomerOrderStatusChange(input: {
  orderId: string;
  userId: string;
  status: string;
  restaurantName?: string | null;
}): Promise<void> {
  const label = ORDER_STATUS_LABELS[input.status] ?? input.status;
  const title =
    input.status === "cancelled"
      ? "Sipariş iptal edildi"
      : input.status === "delivered"
        ? "Sipariş teslim edildi"
        : "Sipariş durumu güncellendi";
  const body = input.restaurantName
    ? `${input.restaurantName} · ${label}`
    : label;
  await deliverUserNotification({
    userId: input.userId,
    kind: "order_status_customer",
    title,
    body,
    orderId: input.orderId,
    route: `/siparis/${input.orderId}`,
    dedupKey: `order-status:${input.orderId}:${input.status}:${input.userId}`,
  });
}

/** Sipariş durumu değişince müşteriye bildirim; sipariş işlemini etkilemez. */
export async function afterOrderStatusUpdated(orderId: string, newStatus: string): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, user_id, status, restaurant_id, restaurants(name)")
      .eq("id", orderId)
      .maybeSingle();
    if (error) throw error;
    if (!order?.user_id) return;
    if (order.status !== newStatus) return;
    const restaurantName =
      order.restaurants && typeof order.restaurants === "object" && "name" in order.restaurants
        ? String((order.restaurants as { name?: string }).name ?? "")
        : null;
    await notifyCustomerOrderStatusChange({
      orderId: order.id,
      userId: order.user_id,
      status: newStatus,
      restaurantName,
    });
  } catch (error) {
    console.error("[notifications] order status notify failed", {
      orderId,
      code: error && typeof error === "object" && "code" in error ? error.code : undefined,
    });
  }
}

export async function founderSendNotifications(input: {
  target: "all" | "all_vendors" | "all_customers" | "restaurant" | "user";
  restaurantId?: string | null;
  userId?: string | null;
  title: string;
  body: string;
  founderUserId: string;
}): Promise<{ sent: number }> {
  const userIds = await resolveFounderTargetUserIds(input);
  const batchId = crypto.randomUUID();
  let sent = 0;
  const pushUserIds: string[] = [];
  for (const userId of userIds) {
    const kind: NotificationKind =
      input.target === "restaurant"
        ? "admin_restaurant"
        : input.target === "user"
          ? "admin_user"
          : "admin_broadcast";
    const created = await insertNotification({
      userId,
      kind,
      title: input.title.trim(),
      body: input.body.trim(),
      restaurantId: input.restaurantId ?? null,
      route: "/bildirimler",
      dedupKey: `admin:${input.founderUserId}:${batchId}:${userId}`,
    });
    if (created) {
      sent += 1;
      pushUserIds.push(userId);
    }
  }
  void sendPushToUsers(pushUserIds, {
    title: input.title.trim(),
    body: input.body.trim(),
    route: "/bildirimler",
  }).catch(() => undefined);
  return { sent };
}

async function resolveFounderTargetUserIds(input: {
  target: "all" | "all_vendors" | "all_customers" | "restaurant" | "user";
  restaurantId?: string | null;
  userId?: string | null;
}): Promise<string[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (input.target === "user") {
    if (!input.userId) return [];
    return [input.userId];
  }
  if (input.target === "restaurant") {
    if (!input.restaurantId) return [];
    return await vendorUserIdsForRestaurant(input.restaurantId);
  }
  if (input.target === "all_vendors") {
    const { data, error } = await supabaseAdmin.from("vendor_assignments").select("user_id");
    if (error) {
      if (isMissingRelationError(error)) return [];
      throw error;
    }
    return [...new Set((data ?? []).map((row) => row.user_id).filter(Boolean))];
  }
  const allUserIds = await listAllAuthUserIds();
  if (input.target === "all") return allUserIds;
  if (input.target === "all_customers") {
    const { data, error } = await supabaseAdmin.from("vendor_assignments").select("user_id");
    if (error) {
      if (isMissingRelationError(error)) return allUserIds;
      throw error;
    }
    const vendorIds = new Set((data ?? []).map((row) => row.user_id).filter(Boolean));
    return allUserIds.filter((id) => !vendorIds.has(id));
  }
  return allUserIds;
}

async function listAllAuthUserIds(): Promise<string[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  return (data.users ?? []).map((user) => user.id).filter(Boolean);
}

async function vendorUserIdsForRestaurant(restaurantId: string): Promise<string[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("vendor_assignments")
    .select("user_id")
    .eq("restaurant_id", restaurantId);
  if (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }
  return (data ?? []).map((row) => row.user_id).filter(Boolean);
}

export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  if (userIds.length === 0) return;
  const accessToken = await getFcmAccessToken();
  if (!accessToken) return;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: tokens, error } = await supabaseAdmin
    .from("device_push_tokens")
    .select("token")
    .in("user_id", userIds);
  if (error) {
    if (isMissingRelationError(error)) return;
    throw error;
  }
  const unique = [...new Set((tokens ?? []).map((row) => row.token).filter(Boolean))];
  await Promise.all(
    unique.map((token) =>
      sendFcmMessage(accessToken, token, payload).catch((pushError) => {
        console.error("[notifications] push failed", {
          code: pushError && typeof pushError === "object" && "code" in pushError ? pushError.code : undefined,
        });
      }),
    ),
  );
}

async function getFcmAccessToken(): Promise<string | null> {
  const projectId = process.env["FIREBASE_PROJECT_ID"] ?? "silvan-cebimde";
  const clientEmail = process.env["FIREBASE_CLIENT_EMAIL"];
  const privateKey = process.env["FIREBASE_PRIVATE_KEY"]?.replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) return null;

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(
    JSON.stringify({
      iss: clientEmail,
      sub: clientEmail,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
    }),
  );
  const unsigned = `${header}.${claim}`;
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsigned),
  );
  const jwt = `${unsigned}.${base64UrlBytes(new Uint8Array(signature))}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!response.ok) {
    console.error("[notifications] FCM OAuth failed", { status: response.status });
    return null;
  }
  const json = (await response.json()) as { access_token?: string };
  return json.access_token ?? null;
}

async function sendFcmMessage(
  accessToken: string,
  deviceToken: string,
  payload: PushPayload,
): Promise<void> {
  const projectId = process.env["FIREBASE_PROJECT_ID"] ?? "silvan-cebimde";
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: deviceToken,
          notification: {
            title: payload.title,
            body: payload.body,
          },
          data: {
            route: payload.route ?? "/bildirimler",
            title: payload.title,
            body: payload.body,
          },
          android: {
            priority: "HIGH",
            notification: { channel_id: "orders" },
          },
        },
      }),
    },
  );
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error("[notifications] FCM send failed", { status: response.status, text: text.slice(0, 200) });
  }
}

function base64Url(value: string): string {
  return base64UrlBytes(new TextEncoder().encode(value));
}

function base64UrlBytes(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const cleaned = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export const __notificationsTest = {
  isUniqueViolation,
  isMissingRelationError,
};
