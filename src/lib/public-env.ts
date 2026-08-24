export type PublicEnv = {
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_PUBLISHABLE_KEY: string;
};

declare global {
  interface Window {
    __PUBLIC_ENV__?: PublicEnv;
  }
}

function fromProcess(name: string): string {
  if (typeof process === "undefined" || !process.env) return "";
  const value = process.env[name];
  return typeof value === "string" ? value : "";
}

function fromVite(name: string): string {
  try {
    const value = import.meta.env[name];
    return typeof value === "string" ? value : "";
  } catch {
    return "";
  }
}

function fromWindow(): PublicEnv | undefined {
  if (typeof globalThis === "undefined") return undefined;
  const bag = (globalThis as { __PUBLIC_ENV__?: PublicEnv }).__PUBLIC_ENV__;
  if (!bag) return undefined;
  if (!bag.VITE_SUPABASE_URL || !bag.VITE_SUPABASE_PUBLISHABLE_KEY) return undefined;
  return bag;
}

/** Yayınlanabilir anahtarlar; service role asla buraya girmez. */
export function getPublicSupabaseEnv(): PublicEnv {
  const fromDom = fromWindow();
  if (fromDom) return fromDom;
  const url =
    fromVite("VITE_SUPABASE_URL") || fromProcess("VITE_SUPABASE_URL") || fromProcess("SUPABASE_URL");
  const key =
    fromVite("VITE_SUPABASE_PUBLISHABLE_KEY") ||
    fromProcess("VITE_SUPABASE_PUBLISHABLE_KEY") ||
    fromProcess("SUPABASE_PUBLISHABLE_KEY");
  return { VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: key };
}

export function publicEnvInlineScript(): string {
  return `window.__PUBLIC_ENV__=${JSON.stringify(getPublicSupabaseEnv())};`;
}
