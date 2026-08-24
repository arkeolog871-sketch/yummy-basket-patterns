import {
  isMissingColumnError,
  SITE_SETTINGS_BASE_COLUMNS,
  SITE_SETTINGS_COLUMNS_FULL,
  SITE_SETTINGS_COLUMNS_WITH_TYPOGRAPHY,
} from "@/lib/typography";

type SettingsClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string,
      ) => {
        maybeSingle: () => Promise<{
          data: Record<string, unknown> | null;
          error: { message?: string; code?: string } | null;
        }>;
      };
    };
  };
};

/** PostgREST 400: eksik sütunu atlayıp tekrar dene. Token/DDL gerekmez. */
export async function fetchSiteSettingsRow(
  client: SettingsClient,
): Promise<Record<string, unknown> | null> {
  const attempts = [
    SITE_SETTINGS_COLUMNS_FULL,
    SITE_SETTINGS_COLUMNS_WITH_TYPOGRAPHY,
    SITE_SETTINGS_BASE_COLUMNS,
  ] as const;

  for (let i = 0; i < attempts.length; i += 1) {
    const columns = attempts[i] as string;
    const { data, error } = await client
      .from("site_settings")
      .select(columns)
      .eq("id", "global")
      .maybeSingle();
    if (!error) return (data ?? {}) as Record<string, unknown>;
    const canRetry =
      (i === 0 &&
        (isMissingColumnError(error, "hero_banners") || isMissingColumnError(error, "typography"))) ||
      (i === 1 && isMissingColumnError(error, "typography"));
    if (canRetry) continue;
    console.error("[site-settings]", error.message);
    return null;
  }
  return null;
}
