import { createServerFn } from "@tanstack/react-start";

/**
 * Harita tarayıcı anahtarını yalnızca sunucu üzerinden verir.
 * Anahtar site_settings tablosundan herkese açık okunamaz.
 */
export const getMapsBrowserKey = createServerFn({ method: "GET" }).handler(async () => {
  const { readMapsConfig } = await import("./maps.server");
  const { key } = await readMapsConfig();
  return { key: key && key.trim() ? key.trim() : null };
});

export const getMapsKeyStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { readMapsConfig } = await import("./maps.server");
  const { key } = await readMapsConfig();
  return { hasKey: Boolean(key && key.trim()) };
});
