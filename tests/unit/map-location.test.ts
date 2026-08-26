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
});
