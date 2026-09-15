import { recordAppError } from "./errors.server";

type NotificationRow = {
  user_id: string;
  title: string;
  body: string;
  url: string | null;
  source_type: "admin_message" | "order_status";
  source_id: string | null;
};

/**
 * Bildirim yazımı hiçbir zaman çağıranın akışını bozmamalı (duyuru gönderimi,
 * sipariş durumu). Ama sessiz de kalmamalı: bu kusur tam olarak sessizlikten
 * doğdu ve 17 duyuru boyunca fark edilmedi. Hata artık kurucu panelindeki
 * sistem hata kayıtlarına düşüyor.
 */
async function report(what: string, error: unknown): Promise<void> {
  const detail =
    error && typeof error === "object"
      ? [
          (error as { code?: string }).code,
          (error as { message?: string }).message,
          (error as { details?: string }).details,
        ]
          .filter(Boolean)
          .join(" · ")
      : String(error);
  console.error(`[notifications] ${what}`, detail);
  await recordAppError({ source: "server", message: `[bildirim] ${what}: ${detail}` });
}

/**
 * Bildirimi kullanıcı başına kalıcı kayıt olarak yazar. Duyurularda aynı
 * (user_id, source_id) çifti için ikinci satır oluşmaz.
 *
 * Tekrarı önlemek eskiden upsert'ün ON CONFLICT'ine bırakılmıştı:
 *
 *   .upsert(rows, { onConflict: "user_id,source_id", ignoreDuplicates: true })
 *
 * Ama veritabanındaki benzersizlik kuralı KISMİ bir indeks:
 *
 *   CREATE UNIQUE INDEX ... ON notifications (user_id, source_id)
 *   WHERE source_type = 'admin_message' AND source_id IS NOT NULL
 *
 * Postgres, ON CONFLICT'e aynı koşul verilmediğinde kısmi indeksi eşleştirmiyor
 * ve sorguyu daha planlama aşamasında 42P10 ile reddediyor. Supabase istemcisi
 * de bu hatayı fırlatmıyor, `{ error }` olarak döndürüyor -- kod o alana
 * bakmadığı için hiçbir duyuru bildirimi hiçbir zaman yazılmadı ve hiçbir yerde
 * hata görünmedi.
 *
 * Artık tekrar kontrolü kodda yapılıyor: önce o duyuru için hangi
 * kullanıcılarda kayıt olduğu okunuyor, kalanlar düz insert ile yazılıyor.
 * Kısmi indeks yerinde duruyor ve eşzamanlı iki gönderime karşı son savunma
 * olarak çalışmaya devam ediyor.
 */
export async function insertNotifications(rows: NotificationRow[]): Promise<void> {
  if (rows.length === 0) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const adminMessageRows = rows.filter((row) => row.source_type === "admin_message");
    const otherRows = rows.filter((row) => row.source_type !== "admin_message");

    if (adminMessageRows.length > 0) {
      const sourceIds = [
        ...new Set(
          adminMessageRows
            .map((row) => row.source_id)
            .filter((value): value is string => Boolean(value)),
        ),
      ];

      const already = new Set<string>();
      if (sourceIds.length > 0) {
        const { data, error } = await supabaseAdmin
          .from("notifications")
          .select("user_id, source_id")
          .eq("source_type", "admin_message")
          .in("source_id", sourceIds);
        if (error) await report("mevcut duyuru kayıtları okunamadı", error);
        for (const row of data ?? []) already.add(`${row.user_id}:${row.source_id}`);
      }

      const fresh = adminMessageRows.filter(
        (row) => !already.has(`${row.user_id}:${row.source_id}`),
      );
      if (fresh.length > 0) {
        const { error } = await supabaseAdmin.from("notifications").insert(fresh);
        if (error) await report("duyuru bildirimi yazılamadı", error);
      }
    }

    if (otherRows.length > 0) {
      const { error } = await supabaseAdmin.from("notifications").insert(otherRows);
      if (error) await report("sipariş bildirimi yazılamadı", error);
    }
  } catch (error) {
    await report("bildirim kaydı beklenmedik şekilde başarısız", error);
  }
}
