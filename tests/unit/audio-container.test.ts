import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  containerFromMimeType,
  resolveAudioContainer,
  sniffAudioContainer,
} from "@/lib/audio-container";

function bytes(...values: number[]): Uint8Array {
  return new Uint8Array([...values, ...new Array(16).fill(0)]);
}

function ascii(text: string, prefix: number[] = []): Uint8Array {
  const body = [...text].map((char) => char.charCodeAt(0));
  return new Uint8Array([...prefix, ...body, ...new Array(16).fill(0)]);
}

describe("ses kabı baytlardan tanınır", () => {
  it("webm/matroska", () => {
    expect(sniffAudioContainer(bytes(0x1a, 0x45, 0xdf, 0xa3))?.extension).toBe("webm");
  });

  it("mp4/m4a — iOS Safari kaydı", () => {
    // Yaşanmış arıza: bu içerik "audio/webm" etiketiyle gönderiliyordu.
    const mp4 = ascii("ftyp", [0, 0, 0, 0x20]);
    expect(sniffAudioContainer(mp4)?.mimeType).toBe("audio/mp4");
    expect(sniffAudioContainer(mp4)?.extension).toBe("m4a");
  });

  it("ogg ve wav", () => {
    expect(sniffAudioContainer(ascii("OggS"))?.extension).toBe("ogg");
    const wav = new Uint8Array([
      ...[..."RIFF"].map((c) => c.charCodeAt(0)),
      0,
      0,
      0,
      0,
      ...[..."WAVE"].map((c) => c.charCodeAt(0)),
      0,
      0,
    ]);
    expect(sniffAudioContainer(wav)?.extension).toBe("wav");
  });

  it("mp3 (ID3 ve çerçeve senkronu)", () => {
    expect(sniffAudioContainer(ascii("ID3"))?.extension).toBe("mp3");
    expect(sniffAudioContainer(bytes(0xff, 0xfb))?.extension).toBe("mp3");
  });

  it("tanınmayan ve çok kısa girdi null", () => {
    expect(sniffAudioContainer(new Uint8Array([1, 2, 3]))).toBeNull();
    expect(sniffAudioContainer(bytes(0x12, 0x34, 0x56, 0x78))).toBeNull();
  });
});

describe("istemci etiketi yalnız yedek", () => {
  it("codec eki atılır", () => {
    expect(containerFromMimeType("audio/webm;codecs=opus")?.extension).toBe("webm");
    expect(containerFromMimeType("audio/mp4;codecs=mp4a.40.2")?.extension).toBe("m4a");
    expect(containerFromMimeType("")).toBeNull();
    expect(containerFromMimeType(undefined)).toBeNull();
  });

  it("baytlar etiketi EZER — yanlış etiketlenen mp4 doğru gider", () => {
    const mp4 = ascii("ftyp", [0, 0, 0, 0x20]);
    expect(resolveAudioContainer(mp4, "audio/webm").extension).toBe("m4a");
  });

  it("baytlar tanınmazsa etiket, o da yoksa webm", () => {
    const unknown = bytes(0x12, 0x34, 0x56, 0x78);
    expect(resolveAudioContainer(unknown, "audio/mp4").extension).toBe("m4a");
    expect(resolveAudioContainer(unknown, "").extension).toBe("webm");
  });
});

describe("yazıya çevirme isteği kodu", () => {
  const source = readFileSync("src/lib/ai-voice.server.ts", "utf8");

  it("kap baytlardan seçilir", () => {
    expect(source).toContain("resolveAudioContainer(bytes, mimeType)");
  });

  it("multipart gövdede content-type elle verilmez (boundary bozulur)", () => {
    const upload = source.slice(
      source.indexOf("/audio/transcriptions"),
      source.indexOf("export async function synthesizeSpeech"),
    );
    expect(upload).not.toMatch(/content-type"?\s*:\s*"multipart/i);
    expect(upload).toContain("body: form");
  });

  it("alan adı 'file', dosya adı kabın uzantısını taşır", () => {
    expect(source).toContain('form.append(\n      "file"');
    expect(source).toContain("`kayit.${container.extension}`");
  });

  it("ağ hatasında sıradaki sağlayıcıyla tek kez yeniden denenir", () => {
    expect(source).toContain("nextAiProviderAfterFailure(provider)");
    expect(source).toContain("Sesli asistan sunucusuna ulaşılamıyor");
  });

  it("yanıttaki metin alanı okunur", () => {
    expect(source).toContain("payload?.text ?? payload?.results?.[0]?.text");
  });
});

describe("sesli sohbet kaydı doğru etiketlenir", () => {
  const voice = readFileSync("src/components/assistant/VoiceConversation.tsx", "utf8");

  it("blob koşulsuz webm değil, kaydedicinin kabıyla etiketlenir", () => {
    expect(voice).toContain("recordedTypeRef.current = recorder.mimeType");
    expect(voice).toContain('new Blob(chunks, { type: recordedTypeRef.current || "audio/webm" })');
    expect(voice).not.toContain('new Blob(chunks, { type: "audio/webm" })');
  });
});
