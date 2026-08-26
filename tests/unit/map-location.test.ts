import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { businessMapMarkers } from "@/components/business/AllBusinessesMap";
import { businessPinPopupHtml } from "@/lib/map-popup";
import { buildMapsUrl, businessDetailPath, resolveBusinessCoords } from "@/lib/maps";

const SIMPIL = {
  id: "simpil-test",
  slug: "simpil-ciftligi",
  name: "Simpil çiftliği",
  address: "Boyunlu mahallesi",
  latitude: 38.161111,
  longitude: 41.012222,
} as const;

describe("business location from latitude/longitude", () => {
  it("uses only lat/lng for the pin, never maps_url", () => {
    expect(
      resolveBusinessCoords({
        name: SIMPIL.name,
        latitude: SIMPIL.latitude,
        longitude: SIMPIL.longitude,
        maps_url: "https://www.google.com/maps/place/@10.0,20.0",
      }),
    ).toEqual({ lat: SIMPIL.latitude, lng: SIMPIL.longitude });

    expect(
      resolveBusinessCoords({
        name: SIMPIL.name,
        maps_url: "https://www.google.com/maps/place/@10.0,20.0",
      }),
    ).toBeNull();
  });

  it("builds the Simpil storefront path from slug", () => {
    expect(businessDetailPath("simpil-ciftligi")).toBe("/restoran/simpil-ciftligi");
  });

  it("places the Simpil pin at the record lat/lng and links the name to the storefront", () => {
    const markers = businessMapMarkers([
      {
        id: SIMPIL.id,
        slug: SIMPIL.slug,
        name: SIMPIL.name,
        address: SIMPIL.address,
        latitude: SIMPIL.latitude,
        longitude: SIMPIL.longitude,
        maps_url: "https://maps.app.goo.gl/ignored",
      },
    ]);
    expect(markers).toEqual([
      {
        lat: SIMPIL.latitude,
        lng: SIMPIL.longitude,
        title: "Simpil çiftliği",
        address: "Boyunlu mahallesi",
        href: "/restoran/simpil-ciftligi",
      },
    ]);
  });

  it("does not create a pin when Simpil has no latitude/longitude", () => {
    expect(
      businessMapMarkers([
        {
          id: SIMPIL.id,
          slug: SIMPIL.slug,
          name: SIMPIL.name,
          maps_url: "https://www.google.com/maps/place/@10.0,20.0",
        },
      ]),
    ).toEqual([]);
  });

  it("does not create a pin when latitude/longitude are not valid numbers", () => {
    const base = { id: SIMPIL.id, slug: SIMPIL.slug, name: SIMPIL.name };
    expect(businessMapMarkers([{ ...base, latitude: "abc", longitude: 41 }])).toEqual([]);
    expect(businessMapMarkers([{ ...base, latitude: 38, longitude: "" }])).toEqual([]);
    expect(businessMapMarkers([{ ...base, latitude: 38, longitude: null }])).toEqual([]);
    expect(businessMapMarkers([{ ...base, latitude: 999, longitude: 41 }])).toEqual([]);
    expect(businessMapMarkers([{ ...base, latitude: 38 }])).toEqual([]);
  });

  it("changing one business lat/lng does not move another business pin", () => {
    const other = {
      id: "other-id",
      slug: "aydin",
      name: "Aydın",
      latitude: 38.1502421,
      longitude: 40.9996722,
    };
    const target = {
      id: SIMPIL.id,
      slug: SIMPIL.slug,
      name: SIMPIL.name,
      latitude: SIMPIL.latitude,
      longitude: SIMPIL.longitude,
    };
    const before = businessMapMarkers([other, target]);
    const after = businessMapMarkers([
      other,
      { ...target, latitude: 38.2, longitude: 41.1 },
    ]);
    expect(before.find((marker) => marker.href === "/restoran/aydin")).toEqual(
      after.find((marker) => marker.href === "/restoran/aydin"),
    );
    expect(after.find((marker) => marker.href === "/restoran/simpil-ciftligi")).toEqual({
      lat: 38.2,
      lng: 41.1,
      title: "Simpil çiftliği",
      address: null,
      href: "/restoran/simpil-ciftligi",
    });
  });

  it("makes the popup title the business name linking to the storefront", () => {
    const html = businessPinPopupHtml({
      title: "Simpil çiftliği",
      href: "/restoran/simpil-ciftligi",
      address: "Boyunlu mahallesi",
    });
    expect(html).toContain('href="/restoran/simpil-ciftligi"');
    expect(html).toContain(">Simpil çiftliği</a>");
    expect(html).not.toContain("Menüye git");
    expect(html).not.toContain("maps.google");
  });

  it("builds Yol tarifi from lat/lng, not from maps_url coordinates", () => {
    expect(
      buildMapsUrl({
        name: SIMPIL.name,
        latitude: SIMPIL.latitude,
        longitude: SIMPIL.longitude,
        maps_url: "https://www.google.com/maps/place/@10.0,20.0",
      }),
    ).toBe(
      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${SIMPIL.latitude},${SIMPIL.longitude}`)}`,
    );

    expect(
      buildMapsUrl({
        name: SIMPIL.name,
        address: SIMPIL.address,
        maps_url: "https://www.google.com/maps/place/@10.0,20.0",
      }),
    ).toContain("Boyunlu");
    expect(
      buildMapsUrl({
        name: SIMPIL.name,
        address: SIMPIL.address,
        maps_url: "https://www.google.com/maps/place/@10.0,20.0",
      }),
    ).not.toContain("10.0");
  });

  it("saves restaurant updates by id only, without generating maps_url", () => {
    const text = readFileSync(join(import.meta.dirname, "../../src/lib/founder.functions.ts"), "utf8");
    expect(text).toMatch(/from\("restaurants"\)\.update\(values\)\.eq\("id", id\)/);
    expect(text).not.toMatch(/maps_url:\s*[`'"]https:\/\/www\.google\.com\/maps/);
  });
});
