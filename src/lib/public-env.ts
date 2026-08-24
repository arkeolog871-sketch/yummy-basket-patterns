export type PublicEnv = {
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_PUBLISHABLE_KEY: string;
};

declare global {
  interface Window {
    __PUBLIC_ENV__?: PublicEnv;
  }
}

function readEnv(name: string): string {
  try {
    const vite = import.meta.env[name];
    if (typeof vite === "string" && vite) return vite;
  } catch {
    /* Lovable üretim demeti import.meta.env anahtarlarını düşürebilir. */
  }
  if (typeof process !== "undefined" && process.env) {
    const value = process.env[name];
    if (typeof value === "string" && value) return value;
  }
  return "";
}

function fromWindow(): PublicEnv | undefined {
  if (typeof globalThis === "undefined") return undefined;
  const bag = (globalThis as { __PUBLIC_ENV__?: PublicEnv }).__PUBLIC_ENV__;
  if (!bag?.VITE_SUPABASE_URL || !bag?.VITE_SUPABASE_PUBLISHABLE_KEY) return undefined;
  return bag;
}

/** Yayınlanabilir anahtarlar. Service role asla buraya girmez. */
export function getPublicSupabaseEnv(): PublicEnv {
  const fromDom = fromWindow();
  if (fromDom) return fromDom;
  const url = readEnv("VITE_SUPABASE_URL") || readEnv("SUPABASE_URL");
  const key =
    readEnv("VITE_SUPABASE_PUBLISHABLE_KEY") ||
    readEnv("VITE_SUPABASE_ANON_KEY") ||
    readEnv("SUPABASE_PUBLISHABLE_KEY") ||
    readEnv("SUPABASE_ANON_KEY");
  return { VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: key };
}

export function publicEnvInlineScript(): string {
  return `window.__PUBLIC_ENV__=${JSON.stringify(getPublicSupabaseEnv())};`;
}
