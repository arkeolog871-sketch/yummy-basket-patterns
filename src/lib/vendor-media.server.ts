const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/avif": "avif",
};

/** Base64 görseli ilgili kovaya yükler ve herkese açık proxy adresini döner. */
export async function uploadRestaurantImage(input: {
  bucket: "product-images" | "business-images";
  restaurantId: string;
  fileName: string;
  contentType: string;
  base64: string;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const extension = EXTENSIONS[input.contentType] ?? "png";
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const path = `${input.restaurantId}/${safeName}`;
  const binary = Uint8Array.from(atob(input.base64), (char) => char.charCodeAt(0));

  const { error } = await supabaseAdmin.storage
    .from(input.bucket)
    .upload(path, binary, { contentType: input.contentType, upsert: false });
  if (error) throw new Error(error.message);

  return { path, url: `/api/public/media/${input.bucket}/${path}` };
}

/** Depolamadan görseli siler; başarısızlık kaydı engellemez. */
export async function removeRestaurantImage(
  bucket: "product-images" | "business-images",
  path: string | null,
) {
  if (!path) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.storage.from(bucket).remove([path]);
}
