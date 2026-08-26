import { supabase } from "@/integrations/supabase/client";

/** OTP doğrulaması sonrası jetonları tarayıcı/Web Clip deposuna yazar ve okunabildiğini doğrular. */
export async function persistVerifiedSession(input: {
  accessToken: string;
  refreshToken: string;
}): Promise<void> {
  const { error } = await supabase.auth.setSession({
    access_token: input.accessToken,
    refresh_token: input.refreshToken,
  });
  if (error) throw new Error(error.message);
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) {
    throw new Error("Oturum bu cihazda kaydedilemedi. Lütfen tekrar deneyin.");
  }
}
