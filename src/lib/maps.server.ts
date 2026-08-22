export async function readMapsConfig(): Promise<{
  key: string | null;
  referrers: string | null;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("site_settings")
    .select("maps_api_key, maps_allowed_referrers")
    .eq("id", "global")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    key: (data?.maps_api_key as string | null) ?? null,
    referrers: (data?.maps_allowed_referrers as string | null) ?? null,
  };
}
