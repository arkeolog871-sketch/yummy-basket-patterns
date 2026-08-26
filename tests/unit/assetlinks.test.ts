import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ANDROID_APP_PACKAGE_NAME, ANDROID_ASSETLINKS } from "@/lib/android-assetlinks";

const ROOT = join(import.meta.dirname, "../..");
const SHA256 = /^[0-9A-F]{2}(?::[0-9A-F]{2}){31}$/;

describe("Android Digital Asset Links", () => {
  it("publishes the production package name without inventing a SHA-256", () => {
    const publicFile = JSON.parse(
      readFileSync(join(ROOT, "public/.well-known/assetlinks.json"), "utf8"),
    ) as typeof ANDROID_ASSETLINKS;
    expect(publicFile).toEqual(ANDROID_ASSETLINKS);
    expect(publicFile[0]?.target.package_name).toBe(ANDROID_APP_PACKAGE_NAME);
    expect(ANDROID_APP_PACKAGE_NAME).toBe("online.uygulamamcebimde.app");
    const fingerprints = publicFile[0]?.target.sha256_cert_fingerprints ?? ["missing"];
    for (const fingerprint of fingerprints) {
      expect(fingerprint).toMatch(SHA256);
    }
  });
});
