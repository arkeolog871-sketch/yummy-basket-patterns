import { supabase } from "@/integrations/supabase/client";

/**
 * Sosyal giriş (Google) sonrası profildeki ad soyad boşsa sağlayıcıdan gelen
 * isimle doldurur. Var olan ismin üzerine asla yazmaz.
 */
export async function fillFullNameFromProvider(): Promise<void> {
  try {
    const { data, error } = await supabase.auth.getUser();
    const user = data?.user;
    if (error || !user) return;

    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");
    const candidate =
      str(meta["full_name"]) ||
      str(meta["name"]) ||
      str(meta["displayName"]) ||
      [str(meta["given_name"]), str(meta["family_name"])].filter(Boolean).join(" ");
    const fullName = candidate.slice(0, 120);
    if (!fullName) return;

    const existing = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    if (existing.error) return;
    if (existing.data && (existing.data.full_name ?? "").trim()) return;

    await supabase.from("profiles").upsert({ id: user.id, full_name: fullName }, { onConflict: "id" });
  } catch {
    // Profil adı doldurma girişin başarısına engel olmamalı.
  }
}
