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
  const body = input.restaurantName ? `${input.restaurantName} · ${label}` : label;
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
  idempotencyKey: string;
}): Promise<{
  broadcastId: string;
  targetCount: number;
  successCount: number;
  failureCount: number;
  duplicate: boolean;
  pushConfigured: boolean;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const title = input.title.trim();
  const body = input.body.trim();
  const idempotencyKey = input.idempotencyKey.trim();
  if (!idempotencyKey) throw new Error("İstek kimliği gerekli");

  const existing = await supabaseAdmin
    .from("notification_broadcasts")
    .select("id, target_count, success_count, failure_count, status")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existing.data && !existing.error) {
    const row = existing.data;
    return {
      broadcastId: row.id,
      targetCount: row.target_count,
      successCount: row.success_count,
      failureCount: row.failure_count,
      duplicate: true,
      pushConfigured: Boolean(
        process.env["FIREBASE_CLIENT_EMAIL"] && process.env["FIREBASE_PRIVATE_KEY"],
      ),
    };
  }

  const userIds = await resolveFounderTargetUserIds(input);
  const insert = await supabaseAdmin
    .from("notification_broadcasts")
    .insert({
      idempotency_key: idempotencyKey,
      title,
      body,
      audience: input.target,
      restaurant_id: input.restaurantId ?? null,
      target_user_id: input.userId ?? null,
      created_by: input.founderUserId,
      status: "sending",
      target_count: userIds.length,
    })
    .select("id")
    .maybeSingle();

  if (insert.error) {
    if (isUniqueViolation(insert.error)) {
      const again = await supabaseAdmin
        .from("notification_broadcasts")
        .select("id, target_count, success_count, failure_count")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      const row = again.data;
      if (row) {
        return {
          broadcastId: row.id,
          targetCount: row.target_count,
          successCount: row.success_count,
          failureCount: row.failure_count,
          duplicate: true,
          pushConfigured: Boolean(
            process.env["FIREBASE_CLIENT_EMAIL"] && process.env["FIREBASE_PRIVATE_KEY"],
          ),
        };
      }
    }
    if (isMissingRelationError(insert.error)) {
      // Migration henüz uygulanmamışsa yine de in-app + push dene.
      return await founderSendNotificationsLegacy({ ...input, title, body, userIds });
    }
    throw new Error(insert.error.message);
  }

  const broadcastId = insert.data?.id;
  if (!broadcastId) throw new Error("Bildirim kaydı oluşturulamadı");

  const kind: NotificationKind =
    input.target === "restaurant"
      ? "admin_restaurant"
      : input.target === "user"
        ? "admin_user"
        : "admin_broadcast";

  let inboxSuccess = 0;
  const pushUserIds: string[] = [];
  const INBOX_CHUNK = 100;
  for (let i = 0; i < userIds.length; i += INBOX_CHUNK) {
    const chunk = userIds.slice(i, i + INBOX_CHUNK);
    await Promise.all(
      chunk.map(async (userId) => {
        const created = await insertNotification({
          userId,
          kind,
          title,
          body,
          restaurantId: input.restaurantId ?? null,
          route: "/bildirimler",
          dedupKey: `admin:${broadcastId}:${userId}`,
        });
        if (created) {
          inboxSuccess += 1;
          pushUserIds.push(userId);
        }
      }),
    );
  }

  const pushConfigured = Boolean(
    process.env["FIREBASE_CLIENT_EMAIL"] && process.env["FIREBASE_PRIVATE_KEY"],
  );
  let pushSuccess = 0;
  let pushFailure = 0;
  if (pushUserIds.length > 0) {
    const pushResult = await sendPushToUsers(pushUserIds, {
      title,
      body,
      route: "/bildirimler",
    });
    pushSuccess = pushResult.successCount;
    pushFailure = pushResult.failureCount;
  }

  // İstatistik: inbox yazımı hedeflenen alıcı; push başarı/başarısız ayrı.
  const successCount = inboxSuccess;
  const failureCount = Math.max(0, userIds.length - inboxSuccess) + pushFailure;

  await supabaseAdmin
    .from("notification_broadcasts")
    .update({
      status: "completed",
      success_count: successCount,
      failure_count: failureCount,
      completed_at: new Date().toISOString(),
    })
    .eq("id", broadcastId);

  if (!pushConfigured && pushUserIds.length > 0) {
    console.error(
      "[notifications] FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY eksik; push atlandı",
      {
        broadcastId,
        recipients: pushUserIds.length,
      },
    );
  }

  return {
    broadcastId,
    targetCount: userIds.length,
    successCount,
    failureCount,
    duplicate: false,
    pushConfigured,
  };
}

async function founderSendNotificationsLegacy(input: {
  target: "all" | "all_vendors" | "all_customers" | "restaurant" | "user";
  restaurantId?: string | null;
  userId?: string | null;
  title: string;
  body: string;
  founderUserId: string;
  idempotencyKey: string;
  userIds: string[];
}): Promise<{
  broadcastId: string;
  targetCount: number;
  successCount: number;
  failureCount: number;
  duplicate: boolean;
  pushConfigured: boolean;
}> {
  const batchId = input.idempotencyKey || crypto.randomUUID();
  let sent = 0;
  const pushUserIds: string[] = [];
  for (const userId of input.userIds) {
    const kind: NotificationKind =
      input.target === "restaurant"
        ? "admin_restaurant"
        : input.target === "user"
          ? "admin_user"
          : "admin_broadcast";
    const created = await insertNotification({
      userId,
      kind,
      title: input.title,
      body: input.body,
      restaurantId: input.restaurantId ?? null,
      route: "/bildirimler",
      dedupKey: `admin:${input.founderUserId}:${batchId}:${userId}`,
    });
    if (created) {
      sent += 1;
      pushUserIds.push(userId);
    }
  }
  const pushResult = await sendPushToUsers(pushUserIds, {
    title: input.title,
    body: input.body,
    route: "/bildirimler",
  });
  return {
    broadcastId: batchId,
    targetCount: input.userIds.length,
    successCount: sent,
    failureCount: Math.max(0, input.userIds.length - sent) + pushResult.failureCount,
    duplicate: false,
    pushConfigured: Boolean(
      process.env["FIREBASE_CLIENT_EMAIL"] && process.env["FIREBASE_PRIVATE_KEY"],
    ),
  };
}

export async function previewFounderAudience(input: {
  target: "all" | "all_vendors" | "all_customers" | "restaurant" | "user";
  restaurantId?: string | null;
  userId?: string | null;
}): Promise<{ targetCount: number; tokenCount: number }> {
  const userIds = await resolveFounderTargetUserIds(input);
  if (userIds.length === 0) return { targetCount: 0, tokenCount: 0 };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("device_push_tokens")
    .select("token")
    .in("user_id", userIds);
  if (error) {
    if (isMissingRelationError(error)) return { targetCount: userIds.length, tokenCount: 0 };
    throw error;
  }
  const tokenCount = new Set((data ?? []).map((row) => row.token).filter(Boolean)).size;
  return { targetCount: userIds.length, tokenCount };
}

export async function listFounderBroadcasts(limit = 40): Promise<
  Array<{
    id: string;
    title: string;
    body: string;
    audience: string;
    status: string;
    target_count: number;
    success_count: number;
    failure_count: number;
    created_at: string;
    completed_at: string | null;
    created_by: string;
  }>
> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("notification_broadcasts")
    .select(
      "id, title, body, audience, status, target_count, success_count, failure_count, created_at, completed_at, created_by",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }
  return data ?? [];
}

/** Hedef kitleyi sunucu tarafında saf filtreler (client’a güvenmez). */
export function filterAudienceUserIds(input: {
  target: "all" | "all_vendors" | "all_customers" | "restaurant" | "user";
  allUserIds: string[];
  vendorUserIds: string[];
  restaurantVendorIds?: string[];
  userId?: string | null;
}): string[] {
  if (input.target === "user") {
    return input.userId ? [input.userId] : [];
  }
  if (input.target === "restaurant") {
    return [...new Set((input.restaurantVendorIds ?? []).filter(Boolean))];
  }
  if (input.target === "all_vendors") {
    return [...new Set(input.vendorUserIds.filter(Boolean))];
  }
  if (input.target === "all") {
    return [...new Set(input.allUserIds.filter(Boolean))];
  }
  if (input.target === "all_customers") {
    const vendorIds = new Set(input.vendorUserIds.filter(Boolean));
    return [...new Set(input.allUserIds.filter((id) => id && !vendorIds.has(id)))];
  }
  return [...new Set(input.allUserIds.filter(Boolean))];
}

async function resolveFounderTargetUserIds(input: {
  target: "all" | "all_vendors" | "all_customers" | "restaurant" | "user";
  restaurantId?: string | null;
  userId?: string | null;
}): Promise<string[]> {
  if (input.target === "user") {
    return filterAudienceUserIds({
      target: "user",
      allUserIds: [],
      vendorUserIds: [],
      userId: input.userId,
    });
  }
  if (input.target === "restaurant") {
    if (!input.restaurantId) return [];
    const restaurantVendorIds = await vendorUserIdsForRestaurant(input.restaurantId);
    return filterAudienceUserIds({
      target: "restaurant",
      allUserIds: [],
      vendorUserIds: [],
      restaurantVendorIds,
    });
  }
  if (input.target === "all_vendors") {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("vendor_assignments").select("user_id");
    if (error) {
      if (isMissingRelationError(error)) return [];
      throw error;
    }
    return filterAudienceUserIds({
      target: "all_vendors",
      allUserIds: [],
      vendorUserIds: (data ?? []).map((row) => row.user_id),
    });
  }
  const allUserIds = await listAllAuthUserIds();
  if (input.target === "all") {
    return filterAudienceUserIds({ target: "all", allUserIds, vendorUserIds: [] });
  }
  if (input.target === "all_customers") {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("vendor_assignments").select("user_id");
    if (error) {
      if (isMissingRelationError(error)) {
        return filterAudienceUserIds({ target: "all", allUserIds, vendorUserIds: [] });
      }
      throw error;
    }
    return filterAudienceUserIds({
      target: "all_customers",
      allUserIds,
      vendorUserIds: (data ?? []).map((row) => row.user_id),
    });
  }
  return filterAudienceUserIds({ target: "all", allUserIds, vendorUserIds: [] });
}

async function listAllAuthUserIds(): Promise<string[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const ids: string[] = [];
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const users = data.users ?? [];
    for (const user of users) {
      if (user.id) ids.push(user.id);
    }
    if (users.length < 1000) break;
  }
  return ids;
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

const FCM_CHUNK = 40;

export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload,
): Promise<{ successCount: number; failureCount: number }> {
  if (userIds.length === 0) return { successCount: 0, failureCount: 0 };
  const accessToken = await getFcmAccessToken();
  if (!accessToken) {
    console.error("[notifications] FCM access token alınamadı; push atlandı");
    return { successCount: 0, failureCount: 0 };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const uniqueTokens = new Set<string>();
  const USER_CHUNK = 200;
  for (let i = 0; i < userIds.length; i += USER_CHUNK) {
    const chunk = userIds.slice(i, i + USER_CHUNK);
    const { data: tokens, error } = await supabaseAdmin
      .from("device_push_tokens")
      .select("token")
      .in("user_id", chunk);
    if (error) {
      if (isMissingRelationError(error)) return { successCount: 0, failureCount: 0 };
      throw error;
    }
    for (const row of tokens ?? []) {
      if (row.token) uniqueTokens.add(row.token);
    }
  }

  const unique = [...uniqueTokens];
  let successCount = 0;
  let failureCount = 0;
  for (let i = 0; i < unique.length; i += FCM_CHUNK) {
    const chunk = unique.slice(i, i + FCM_CHUNK);
    const results = await Promise.all(
      chunk.map((token) => sendFcmMessage(accessToken, token, payload)),
    );
    for (const result of results) {
      if (result.ok) successCount += 1;
      else failureCount += 1;
    }
  }
  return { successCount, failureCount };
}

async function getFcmAccessToken(): Promise<string | null> {
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
): Promise<{ ok: boolean }> {
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
          apns: {
            headers: { "apns-priority": "10" },
            payload: { aps: { sound: "default" } },
          },
        },
      }),
    },
  );
  if (response.ok) return { ok: true };

  const text = await response.text().catch(() => "");
  console.error("[notifications] FCM send failed", {
    status: response.status,
    text: text.slice(0, 200),
  });
  if (response.status === 404 || isStaleFcmErrorText(text)) {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("device_push_tokens").delete().eq("token", deviceToken);
    } catch (cleanupError) {
      console.error("[notifications] stale token cleanup failed", {
        code:
          cleanupError && typeof cleanupError === "object" && "code" in cleanupError
            ? cleanupError.code
            : undefined,
      });
    }
  }
  return { ok: false };
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

/** FCM yanıt metninden geçersiz/eski token tespiti (tek başarısız gönderim tüm batch’i durdurmaz). */
export function isStaleFcmErrorText(text: string): boolean {
  return /UNREGISTERED|NOT_FOUND|INVALID_ARGUMENT|Requested entity was not found/i.test(text);
}

export const __notificationsTest = {
  isUniqueViolation,
  isMissingRelationError,
  filterAudienceUserIds,
  isStaleFcmErrorText,
};
