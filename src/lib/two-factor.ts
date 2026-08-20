import { supabase } from "@/integrations/supabase/client";

const FLAG_KEY = "sofra-founder-2fa";

/** Yedek kod ile doğrulanan oturumu bu sekme için işaretler. */
export function markBackupCodeVerified(userId: string) {
  try {
    sessionStorage.setItem(FLAG_KEY, userId);
  } catch {
    /* sessionStorage kapalıysa yoksay */
  }
}

export function clearTwoFactorFlag() {
  try {
    sessionStorage.removeItem(FLAG_KEY);
  } catch {
    /* yoksay */
  }
}

function hasBackupFlag(userId: string) {
  try {
    return sessionStorage.getItem(FLAG_KEY) === userId;
  } catch {
    return false;
  }
}

export type TwoFactorState = {
  /** Doğrulanmış bir TOTP faktörü var mı? */
  enrolled: boolean;
  /** Bu oturum ikinci adımı geçti mi? */
  satisfied: boolean;
  factorId: string | null;
};

export async function readTwoFactorState(userId: string): Promise<TwoFactorState> {
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified = (factors?.totp ?? []).find((factor) => factor.status === "verified") ?? null;
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const satisfied = aal?.currentLevel === "aal2" || hasBackupFlag(userId);
  return {
    enrolled: Boolean(verified),
    satisfied: verified ? satisfied : true,
    factorId: verified?.id ?? null,
  };
}
