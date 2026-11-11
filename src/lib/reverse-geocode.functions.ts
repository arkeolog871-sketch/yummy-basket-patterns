import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type ReverseGeocodeResult = { address: string; district: string; city: string };

/** Koordinattan adres/ilçe/şehir (OpenStreetMap Nominatim, sunucudan). */
export const reverseGeocode = createServerFn({ method: "POST" })
  .inputValidator(z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }))
  .handler(async ({ data }): Promise<ReverseGeocodeResult | null> => {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=tr&addressdetails=1&lat=${data["lat"]}&lon=${data["lng"]}`;
      const res = await fetch(url, {
        headers: { "User-Agent": "SilvanCebimde/1.0 (uygulamamcebimde.online)" },
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { address?: Partial<Record<string, string>> };
      const a = json.address ?? {};
      const street = [a["neighbourhood"] || a["suburb"] || a["quarter"], a["road"], a["house_number"]]
        .filter(Boolean)
        .join(", ");
      return {
        address: street,
        district: a["town"] || a["county"] || a["city_district"] || a["municipality"] || "",
        city: a["province"] || a["state"] || a["city"] || "",
      };
    } catch {
      return null;
    }
  });
