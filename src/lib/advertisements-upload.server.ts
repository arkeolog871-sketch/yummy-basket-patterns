import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
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
  await assertFounder(supabase, data.claims.sub, data.claims as never);
  return supabase;
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

export function bytesFromBase64(base64: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64, "base64"));
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
    if (error) throw new Error(error.message);
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
  if (error) throw new Error(error.message);
  const published = input.supabase.storage.from(BANNERS_BUCKET).getPublicUrl(path);
  const url = published.data.publicUrl;
  if (!url) throw new Error("Görsel adresi alınamadı");
  return { url, path };
}
