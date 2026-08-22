import { createServerFn } from "@tanstack/react-start";

/**
 * Harita tarayıcı anahtarını yalnızca sunucu üzerinden verir.
 * Anahtar veritabanında herkese açık okunabilir bir tabloda tutulmaz.
 */
export const getMapsBrowserKey = createServerFn({ method: "GET" }).handler(async () => {
  const { readMapsConfig } = await import("./maps.server");
  const { key } = await readMapsConfig();
  return { key: key && key.trim() ? key.trim() : null };
});

export const getMapsKeyStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { readMapsConfig } = await import("./maps.server");
  const { key, referrers } = await readMapsConfig();
  return { hasKey: Boolean(key && key.trim()), referrers: referrers ?? "" };
});
