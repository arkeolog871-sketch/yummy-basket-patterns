import { createPrivateKey, sign } from "node:crypto";
import { formatVendorMobileNotification } from "@/lib/vendor-mobile-notification";

type ServiceAccount = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

type AccessToken = { value: string; expMs: number };

let cachedAccess: AccessToken | null = null;

function readServiceAccount(): ServiceAccount | null {
  const raw = process.env["FIREBASE_SERVICE_ACCOUNT_JSON"];
  if (!raw || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as ServiceAccount;
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) return null;
    return parsed;
  } catch {
    return null;
  }
}

function b64url(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function getAccessToken(account: ServiceAccount): Promise<string | null> {
  const now = Date.now();
  if (cachedAccess && cachedAccess.expMs - 60_000 > now) return cachedAccess.value;
  const issued = Math.floor(now / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      iss: account.client_email,
      sub: account.client_email,
      aud: "https://oauth2.googleapis.com/token",
      iat: issued,
      exp: issued + 3600,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
    }),
  );
  const unsigned = `${header}.${payload}`;
  const key = createPrivateKey({
    key: account.private_key!.replace(/\\n/g, "\n"),
    format: "pem",
  });
  const signature = b64url(sign("RSA-SHA256", Buffer.from(unsigned), key));
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: `${unsigned}.${signature}`,
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    console.error("[vendor-fcm] google access token alınamadı", { status: response.status });
    return null;
  }
  const json = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) return null;
  cachedAccess = {
    value: json.access_token,
    expMs: now + Math.max(60, Number(json.expires_in) || 3600) * 1000,
  };
  return cachedAccess.value;
}

function isGoneToken(status: number, errorText: string): boolean {
  if (status === 404) return true;
  return /UNREGISTERED|INVALID_ARGUMENT|NOT_FOUND/i.test(errorText);
}

/** Sipariş oluşturmayı beklemez; kimlik yoksa no-op. Hata fırlatmaz. */
export async function notifyVendorFcmPush(orderId: string): Promise<void> {
  try {
    await notifyVendorFcmPushUnsafe(orderId);
  } catch (error) {
    console.error("[vendor-fcm] bildirim gönderilemedi", {
      orderId,
      code: error && typeof error === "object" && "code" in error ? error.code : undefined,
    });
  }
}

async function notifyVendorFcmPushUnsafe(orderId: string): Promise<void> {
  const account = readServiceAccount();
  if (!account) return;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select("id, restaurant_id, total, order_items(name, quantity)")
    .eq("id", orderId)
    .maybeSingle();
  if (orderError || !order) return;

  const { data: assigned, error: assignedError } = await supabaseAdmin
    .from("vendor_assignments")
    .select("user_id")
    .eq("restaurant_id", order.restaurant_id);
  if (assignedError) return;
  const allowedUsers = new Set((assigned ?? []).map((row) => row.user_id));
  if (allowedUsers.size === 0) return;

  const { data: tokens, error: tokenError } = await supabaseAdmin
    .from("vendor_push_tokens")
    .select("token, user_id")
    .eq("restaurant_id", order.restaurant_id)
    .eq("platform", "android");
  if (tokenError || !tokens?.length) return;

  const unique = new Map<string, string>();
  for (const row of tokens) {
    if (!allowedUsers.has(row.user_id)) continue;
    if (!row.token) continue;
    unique.set(row.token, row.user_id);
  }
  if (unique.size === 0) return;

  const notice = formatVendorMobileNotification({
    orderId: order.id,
    total: Number(order.total),
    items: (order.order_items ?? []).map((line) => ({
      name: line.name,
      quantity: Number(line.quantity),
    })),
  });

  const access = await getAccessToken(account);
  if (!access) return;

  const endpoint = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(account.project_id!)}/messages:send`;
  for (const [token, userId] of unique) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${access}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token,
            notification: {
              title: notice.title,
              body: notice.body,
            },
            data: {
              open_url: notice.url,
              order_id: order.id,
            },
            android: {
              priority: "HIGH",
              collapse_key: order.id.replace(/-/g, "").slice(0, 64),
              notification: {
                channel_id: "orders",
                tag: order.id,
                notification_count: 1,
                click_action: "online.uygulamamcebimde.app.OPEN_VENDOR_ORDER",
              },
            },
          },
        }),
      });
      if (response.ok) continue;
      const text = await response.text();
      if (isGoneToken(response.status, text)) {
        await supabaseAdmin.from("vendor_push_tokens").delete().eq("token", token).eq("user_id", userId);
        continue;
      }
      console.error("[vendor-fcm] gönderim başarısız", { status: response.status, orderId: order.id });
    } catch {
      console.error("[vendor-fcm] gönderim başarısız", { orderId: order.id });
    }
  }
}

export const __vendorFcmTest = {
  readServiceAccount,
  isGoneToken,
};
