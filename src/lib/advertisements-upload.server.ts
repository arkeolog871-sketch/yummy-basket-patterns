import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { parseActionType, sanitizeActionValue, type AdActionType } from "@/lib/advertisements";
import { BANNERS_BUCKET, contentTypeForBrandPath, MAX_AD_MEDIA_BYTES } from "@/lib/upload-limits";

const SAFE_EXT = /^(png|jpg|jpeg|webp|gif|avif|bmp|svg|ico|heic|heif|mp4|mov|webm)$/i;

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    if (
      (supabaseKey.startsWith("sb_publishable_") || supabaseKey.startsWith("sb_secret_")) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

export async function founderClientFromRequest(request: Request) {
  const url = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
  const key =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ||
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Supabase ortam değişkenleri eksik");

  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    throw new Error("Unauthorized: No authorization header provided");
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token || token.split(".").length !== 3) {
    throw new Error("Unauthorized: Invalid token");
  }

  const supabase = createClient<Database>(url, key, {
    global: {
      fetch: createSupabaseFetch(key),
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) throw new Error("Unauthorized: Invalid token");

  const { assertFounder } = await import("@/lib/founder.server");
  const claims = (data.claims ?? {}) as Record<string, unknown>;
  const userId = typeof claims["sub"] === "string" ? claims["sub"] : "";
  if (!userId) throw new Error("Unauthorized: Invalid token");
  await assertFounder(supabase, userId, data.claims as never);
  const emailRaw = claims["email"];
  return {
    supabase,
    userId,
    email: typeof emailRaw === "string" ? emailRaw : null,
  };
}

function extensionOf(fileName: string, contentType: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  const ext = dot >= 0 ? base.slice(dot + 1).toLowerCase() : "";
  if (SAFE_EXT.test(ext)) return ext === "jpeg" ? "jpg" : ext;
  const mime = contentType.trim().toLowerCase();
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  if (mime === "image/heic") return "heic";
  if (mime === "image/heif") return "heif";
  if (mime === "video/mp4") return "mp4";
  if (mime === "video/webm") return "webm";
  if (mime === "video/quicktime") return "mov";
  if (mime.startsWith("image/")) {
    const subtype = mime.slice("image/".length).split("+")[0] ?? "";
    if (subtype === "svg") return "svg";
    if (SAFE_EXT.test(subtype)) return subtype;
  }
  throw new Error("Yalnızca görsel veya video yükleyin (PNG, JPEG, MP4, MOV, WEBM…)");
}

export async function uploadFounderBannerFile(input: {
  supabase: ReturnType<typeof createClient<Database>>;
  bytes: Uint8Array;
  fileName: string;
  contentType: string;
}): Promise<{ url: string; path: string }> {
  if (input.bytes.byteLength === 0) throw new Error("Dosya boş");
  if (input.bytes.byteLength > MAX_AD_MEDIA_BYTES) {
    throw new Error(`Dosya ${Math.round(MAX_AD_MEDIA_BYTES / (1024 * 1024))} MB sınırını aşıyor`);
  }
  const extension = extensionOf(input.fileName, input.contentType);
  const path = `ads/${randomUUID()}.${extension}`;
  const contentType = input.contentType || contentTypeForBrandPath(path);

  const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (serviceKey) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.storage.from(BANNERS_BUCKET).upload(path, input.bytes, {
      cacheControl: "3600",
      upsert: false,
      contentType,
    });
    if (error) throw new Error(storageUploadMessage(error.message));
    const published = supabaseAdmin.storage.from(BANNERS_BUCKET).getPublicUrl(path);
    const url = published.data.publicUrl;
    if (!url) throw new Error("Görsel adresi alınamadı");
    return { url, path };
  }

  const { error } = await input.supabase.storage.from(BANNERS_BUCKET).upload(path, input.bytes, {
    cacheControl: "3600",
    upsert: false,
    contentType,
  });
  if (error) throw new Error(storageUploadMessage(error.message));
  const published = input.supabase.storage.from(BANNERS_BUCKET).getPublicUrl(path);
  const url = published.data.publicUrl;
  if (!url) throw new Error("Görsel adresi alınamadı");
  return { url, path };
}

function storageUploadMessage(raw: string): string {
  const text = raw.trim();
  if (!text) return "Dosya yüklenemedi";
  const lower = text.toLowerCase();
  if (lower.includes("mime") || lower.includes("not allowed") || lower.includes("invalid content")) {
    return "Yalnızca görsel veya video yükleyin (PNG, JPEG, MP4, MOV, WEBM…)";
  }
  if (lower.includes("payload") || lower.includes("too large") || lower.includes("maximum")) {
    return `Dosya ${Math.round(MAX_AD_MEDIA_BYTES / (1024 * 1024))} MB sınırını aşıyor`;
  }
  if (lower.includes("row-level security") || lower.includes("unauthorized") || lower.includes("403")) {
    return "Yükleme yetkisi yok. Kurucu hesabıyla giriş yapın.";
  }
  return "Dosya yüklenemedi";
}

function formText(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function formBool(form: FormData, key: string, fallback: boolean): boolean {
  const value = form.get(key);
  if (typeof value !== "string") return fallback;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return fallback;
}

function formInt(form: FormData, key: string, fallback: number): number {
  const n = Number(formText(form, key));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(9999, Math.max(0, Math.round(n)));
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function uploadAndSaveFounderBanner(request: Request): Promise<{
  url: string;
  path: string;
  id: string | null;
}> {
  const { supabase, userId, email } = await founderClientFromRequest(request);
  const form = await request.formData();

  let imageUrl = formText(form, "image_url");
  let path = "";
  const file = form.get("file");
  if (file instanceof Blob && file.size > 0) {
    const named = file as Blob & { name?: string };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const uploaded = await uploadFounderBannerFile({
      supabase,
      bytes,
      fileName: typeof named.name === "string" ? named.name : "reklam",
      contentType: file.type || "application/octet-stream",
    });
    imageUrl = uploaded.url;
    path = uploaded.path;
  }

  const title = formText(form, "title").slice(0, 120);
  if (!title) throw new Error("Başlık girin");
  if (!imageUrl) throw new Error("Galeriden bir görsel veya video seçin");

  const actionType = parseActionType(formText(form, "action_type")) as AdActionType;
  const actionValue = sanitizeActionValue(actionType, formText(form, "action_value"));
  if (!actionValue) {
    throw new Error("Aksiyon hedefi geçersiz (telefon, /rota veya https:// bağlantı).");
  }

  const clientPhone = formText(form, "client_phone").slice(0, 30);
  if (clientPhone && !/^[0-9+()\s-]{10,30}$/.test(clientPhone)) {
    throw new Error("Geçerli bir telefon girin");
  }

  const start = new Date(formText(form, "start_date"));
  const end = new Date(formText(form, "end_date"));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    throw new Error("Bitiş tarihi başlangıçtan sonra olmalıdır.");
  }

  const idRaw = formText(form, "id");
  const id = UUID_RE.test(idRaw) ? idRaw : "";
  const values = {
    title,
    client_name: formText(form, "client_name").slice(0, 80),
    client_phone: clientPhone,
    image_url: imageUrl.slice(0, 500),
    action_type: actionType,
    action_value: actionValue,
    display_order: formInt(form, "display_order", 0),
    is_active: formBool(form, "is_active", true),
    start_date: start.toISOString(),
    end_date: end.toISOString(),
  };

  const { audited } = await import("@/lib/audit.server");
  return audited(
    {
      actorId: userId,
      actorEmail: email,
      action: id ? "advertisement.update" : "advertisement.create",
      entity: "advertisements",
      entityId: id || null,
      detail: { title: values.title, action_type: values.action_type },
    },
    async () => {
      if (id) {
        const { error } = await supabase.from("advertisements").update(values).eq("id", id);
        if (error) throw new Error(error.message);
        return { url: imageUrl, path, id };
      }
      const { data: inserted, error } = await supabase
        .from("advertisements")
        .insert(values)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      const insertedId = inserted && typeof inserted["id"] === "string" ? inserted["id"] : null;
      return { url: imageUrl, path, id: insertedId };
    },
  );
}
