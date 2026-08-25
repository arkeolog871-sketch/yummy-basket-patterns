/** Shared guards so local/staging tools cannot target production. */

export const PRODUCTION_PROJECT_REF = "wxkyhwkcuiqxxxpawcid";
export const PRODUCTION_HOST = "uygulamamcebimde.online";

export function looksLikeProduction(value) {
  if (!value) return false;
  const text = String(value).toLowerCase();
  return text.includes(PRODUCTION_PROJECT_REF) || text.includes(PRODUCTION_HOST);
}

export function assertNotProduction(label, value) {
  if (looksLikeProduction(value)) {
    throw new Error(`${label} production ortamına işaret ediyor; işlem durduruldu.`);
  }
}

export function stagingConfigured() {
  return Boolean(
    process.env.STAGING_DATABASE_URL ||
      process.env.STAGING_SUPABASE_DB_URL ||
      process.env.STAGING_APP_URL,
  );
}
