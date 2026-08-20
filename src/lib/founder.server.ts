import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export async function isFounderUser(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "founder",
  });
  if (error) throw new Error(error.message);
  return data === true;
}

export async function assertFounder(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<void> {
  if (!(await isFounderUser(supabase, userId))) throw new Error("Forbidden");
}