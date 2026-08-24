#!/usr/bin/env node
/**
 * Reklam yükleme sniff simülasyonu — sunucu prepareAdMediaBytes ile aynı kurallar.
 * Çalıştır: node --experimental-strip-types --no-warnings scripts/ad-upload-sim.mts
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { prepareAdMediaBytes } from "../src/lib/vendor-media.server.ts";
import { contentTypeForBrandPath, isAdVideoUrl } from "../src/lib/upload-limits.ts";

const MAX = 30 * 1024 * 1024;
const dir = "/tmp/ad-upload-sim";
mkdirSync(dir, { recursive: true });

function pass(name: string, ok: boolean, detail = "") {
  const mark = ok ? "PASS" : "FAIL";
  console.log(`${mark}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) process.exitCode = 1;
}

function trySniff(label: string, bytes: Uint8Array, expect: { ok: boolean; ext?: string; type?: string }) {
  try {
    const result = prepareAdMediaBytes(bytes, MAX);
    const ok = expect.ok && result.extension === (expect.ext ?? result.extension) && result.contentType === (expect.type ?? result.contentType);
    pass(label, ok, `${result.contentType} .${result.extension}`);
  } catch (error) {
    pass(label, !expect.ok, error instanceof Error ? error.message : String(error));
  }
}

const jpeg = readFileSync(new URL("../public/sim/banner.jpg", import.meta.url));
const mp4 = readFileSync(new URL("../public/sim/banner.mp4", import.meta.url));
writeFileSync(join(dir, "ok.jpg"), jpeg);
writeFileSync(join(dir, "ok.mp4"), mp4);

trySniff("JPEG örnek banner", jpeg, { ok: true, ext: "jpg", type: "image/jpeg" });
trySniff("MP4 örnek banner", mp4, { ok: true, ext: "mp4", type: "video/mp4" });
trySniff("PNG imza", new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]), {
  ok: true,
  ext: "png",
  type: "image/png",
});
trySniff("GIF89a imza", new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0]), {
  ok: true,
  ext: "gif",
  type: "image/gif",
});
trySniff("PDF reddi", new TextEncoder().encode("%PDF-1.7 fake"), { ok: false });
trySniff("boş dosya reddi", new Uint8Array(), { ok: false });
trySniff("30MB+ reddi", new Uint8Array(MAX + 1), { ok: false });

const displayJpg = contentTypeForBrandPath("/sim/banner.jpg");
const displayMp4 = contentTypeForBrandPath("/sim/banner.mp4");
pass("görüntüleme JPEG → img/jpeg", displayJpg === "image/jpeg" && !isAdVideoUrl("/sim/banner.jpg"), displayJpg);
pass("görüntüleme MP4 → video/mp4", displayMp4 === "video/mp4" && isAdVideoUrl("/sim/banner.mp4"), displayMp4);
pass("görüntüleme MOV MIME", contentTypeForBrandPath("ads/x.mov") === "video/quicktime");
pass("görüntüleme WEBM MIME", contentTypeForBrandPath("ads/x.webm") === "video/webm");

if (process.exitCode) {
  console.error("Simülasyon başarısız.");
  process.exit(process.exitCode);
}
console.log("Yükleme + görüntüleme sniff simülasyonu tamam.");
