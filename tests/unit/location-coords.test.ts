import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LATITUDE_FIELD_PLACEHOLDER,
  LONGITUDE_FIELD_PLACEHOLDER,
  SILVAN_DEFAULT_COORDS,
} from "@/lib/location";
import { resolveBusinessCoords } from "@/lib/maps";

const ROOT = join(import.meta.dirname, "../..");
const RETIRED_LAT = "38.1423";
const RETIRED_LNG = "41.0021";

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (
      entry === "node_modules" ||
      entry === ".git" ||
      entry === "dist" ||
      entry === ".output" ||
      entry === "test-results" ||
      entry === "playwright-report"
    ) {
      continue;
    }
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

describe("Silvan location coordinates", () => {
  it("pins the founder hint to the production Aydın coordinates", () => {
    expect(SILVAN_DEFAULT_COORDS.latitude).toBe(38.1502421);
    expect(SILVAN_DEFAULT_COORDS.longitude).toBe(40.9996722);
    expect(LATITUDE_FIELD_PLACEHOLDER).toBe("Enlem (38.1502421)");
    expect(LONGITUDE_FIELD_PLACEHOLDER).toBe("Boylam (40.9996722)");
  });

  it("does not keep the retired Silvan pin in app source", () => {
    const files = walk(join(ROOT, "src"))
      .concat(walk(join(ROOT, "public")))
      .concat(walk(join(ROOT, "supabase")));
    for (const file of files) {
      if (/\.(png|jpg|jpeg|webp|gif|ico|woff2?|ttf|mp4|apk|mobileconfig)$/i.test(file)) continue;
      const text = readFileSync(file, "utf8");
      expect(text, relative(ROOT, file)).not.toContain(RETIRED_LAT);
      expect(text, relative(ROOT, file)).not.toContain(RETIRED_LNG);
    }
  });

  it("uses restaurant lat/lng before maps_url, including the live Aydın pin", () => {
    expect(
      resolveBusinessCoords({
        name: "Aydın",
        latitude: SILVAN_DEFAULT_COORDS.latitude,
        longitude: SILVAN_DEFAULT_COORDS.longitude,
        maps_url: "https://maps.app.goo.gl/bDtJhbZJ3UKeJDCC7?g_st=ac",
      }),
    ).toEqual({ lat: 38.1502421, lng: 40.9996722 });

    expect(
      resolveBusinessCoords({
        name: "Aydın",
        maps_url: "https://maps.app.goo.gl/bDtJhbZJ3UKeJDCC7?g_st=ac",
      }),
    ).toBeNull();
  });

  it("wires founder placeholders from the shared constant", () => {
    const text = readFileSync(join(ROOT, "src/routes/kurucu.tsx"), "utf8");
    expect(text).toContain("LATITUDE_FIELD_PLACEHOLDER");
    expect(text).toContain("LONGITUDE_FIELD_PLACEHOLDER");
    expect(text).not.toContain(RETIRED_LAT);
    expect(text).not.toContain(RETIRED_LNG);
  });
});
