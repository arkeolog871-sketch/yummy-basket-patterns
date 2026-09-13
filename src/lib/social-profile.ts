import { supabase } from "@/integrations/supabase/client";

/**
 * Sosyal giriş (Google / Apple) sonrası profildeki ad soyad boşsa sağlayıcıdan
 * gelen isimle doldurur. Var olan ismin üzerine asla yazmaz.
 *
 * `fallbackName` yalnızca Apple için gerekli: Apple adı ID token'a koymaz,
 * sadece ilk yetkilendirmede native kimlik bilgisiyle bir kez verir. Bu yüzden
 * user_metadata'da hiç görünmez ve kaçırılırsa bir daha gelmez.
 */
export async function fillFullNameFromProvider(fallbackName?: string): Promise<void> {
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
      [str(meta["given_name"]), str(meta["family_name"])].filter(Boolean).join(" ") ||
      str(fallbackName);
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
