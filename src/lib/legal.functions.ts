import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runServerFn } from "./public-error";

/**
 * Bu andan sonra açılan hesaplardan yasal onay istenir; öncekilere hiç
 * dokunulmaz. Google/Apple ile açılmış eski kayıtların onayı yok ama onları
 * girişte engellemek istemiyoruz.
 *
 * Kayan bir "son N dakika" penceresi yerine sabit kesim anı kullanılıyor:
 * pencere yaklaşımı hem "mevcut kullanıcı" tanımını zamanla kaydırıyor hem de
 * açık bırakıyordu — hesabı açıp uygulamayı kapatan, pencere dolduktan sonra
 * dönünce hiç onay vermeden devam edebiliyordu. Sabit kesimle yeni hesap,
 * onaylayana kadar sorulmaya devam eder.
 */
const CONSENT_REQUIRED_AFTER = Date.parse("2026-09-13T10:40:00Z");

/** Bu kullanıcıdan yasal onay istenmeli mi? */
export const getLegalConsentRequirement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    runServerFn(async () => {
      const { data: profile, error } = await context.supabase
        .from("profiles")
        .select("terms_accepted")
        .eq("id", context.userId)
        .maybeSingle();
      // Okunamıyorsa onay isteme: yanlış alarmla girişi kilitlemek, eksik
      // onaydan daha kötü.
      if (error) return { required: false };
      if (profile?.terms_accepted) {
        // Yeni sürüm yayınlandıysa daha önce eski sürümü kabul edenlerden
        // yeniden kabul istenir.
        const { LEGAL_VERSIONS } = await import("./legal");
        const { data: last } = await context.supabase
          .from("legal_acceptances")
          .select("version")
          .eq("user_id", context.userId)
          .eq("doc_type", "terms")
          .eq("acceptance_type", "contract_accept")
          .order("accepted_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        return { required: Boolean(last && last.version < LEGAL_VERSIONS.terms) };
      }

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error: adminError } = await supabaseAdmin.auth.admin.getUserById(
        context.userId,
      );
      const createdAt = data?.user?.created_at;
      if (adminError || !createdAt) return { required: false };
      return { required: new Date(createdAt).getTime() >= CONSENT_REQUIRED_AFTER };
    }),
  );

/** Onay kutusu işaretlenip devam edildiğinde çağrılır. */
export const acceptLegalTerms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    runServerFn(async () => {
      const { recordTermsAcceptance } = await import("./otp.server");
      const result = await recordTermsAcceptance(context.userId, "consent_gate");
      if (!result.ok) throw new Error(result.error);
      return { ok: true };
    }),
  );
