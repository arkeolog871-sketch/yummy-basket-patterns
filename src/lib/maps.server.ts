export async function readMapsConfig(): Promise<{
  key: string | null;
  referrers: string | null;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("maps_config")
    .select("api_key, allowed_referrers")
    .eq("id", "global")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    key: (data?.api_key as string | null) ?? null,
    referrers: (data?.allowed_referrers as string | null) ?? null,
  };
}

export async function writeMapsConfig(values: {
  key?: string | null;
  clearKey?: boolean;
  referrers: string | null;
}): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const patch: Record<string, unknown> = {
    id: "global",
    allowed_referrers: values.referrers,
    updated_at: new Date().toISOString(),
  };
  if (values.clearKey) patch["api_key"] = null;
  else if (values.key) patch["api_key"] = values.key;

  const { error } = await supabaseAdmin.from("maps_config").upsert(patch, { onConflict: "id" });
  if (error) throw new Error(error.message);
}
