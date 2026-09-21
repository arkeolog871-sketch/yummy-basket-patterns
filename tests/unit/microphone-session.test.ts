import { describe, expect, it } from "vitest";
import {
  MicrophoneSession,
  classifyMicrophoneError,
  type AudioStreamLike,
  type RecorderLike,
} from "@/lib/microphone-session";

/** Durdurulup durdurulmadığını sayan sahte ses kanalı. */
function fakeStream() {
  const stopped: number[] = [];
  const stream: AudioStreamLike & { stoppedCount: () => number } = {
    getTracks: () => [{ stop: () => stopped.push(1) }, { stop: () => stopped.push(2) }],
    stoppedCount: () => stopped.length,
  };
  return stream;
}

function fakeRecorder(): RecorderLike {
  return {
    state: "inactive",
    ondataavailable: null,
    onstop: null,
    start() {
      this.state = "recording";
    },
    stop() {
      this.state = "inactive";
      this.onstop?.();
    },
  };
}

const noop = () => {};

describe("mikrofon oturumu akışı bırakır", () => {
  it("kayıt normal bittiğinde kanallar durur", async () => {
    const stream = fakeStream();
    const session = new MicrophoneSession({
      openStream: async () => stream,
      createRecorder: () => fakeRecorder(),
    });

    await session.start(noop, noop);
    expect(session.active).toBe(true);
    expect(stream.stoppedCount()).toBe(0);

    session.stop();
    expect(stream.stoppedCount()).toBe(2);
    expect(session.active).toBe(false);
  });

  it("kaydedici kurucusu patlarsa akış açık kalmaz", async () => {
    // Yaşanmış sızıntı yolu: getUserMedia başarılı, MediaRecorder kurucusu
    // hata atıyor. Akış bırakılmazsa mikrofon sayfanın elinde kalır ve bir
    // sonraki deneme NotReadableError alır.
    const stream = fakeStream();
    const session = new MicrophoneSession({
      openStream: async () => stream,
      createRecorder: () => {
        throw new Error("mimeType desteklenmiyor");
      },
    });

    await expect(session.start(noop, noop)).rejects.toThrow("mimeType desteklenmiyor");
    expect(stream.stoppedCount()).toBe(2);
    expect(session.active).toBe(false);
  });

  it("recorder.start() patlarsa akış açık kalmaz", async () => {
    const stream = fakeStream();
    const session = new MicrophoneSession({
      openStream: async () => stream,
      createRecorder: () => ({
        ...fakeRecorder(),
        start() {
          throw new Error("başlatılamadı");
        },
      }),
    });

    await expect(session.start(noop, noop)).rejects.toThrow("başlatılamadı");
    expect(stream.stoppedCount()).toBe(2);
  });

  it("release() kayıt sürerken de bırakır ve iki kez çağrılabilir", async () => {
    const stream = fakeStream();
    const session = new MicrophoneSession({
      openStream: async () => stream,
      createRecorder: () => fakeRecorder(),
    });

    await session.start(noop, noop);
    session.release();
    expect(stream.stoppedCount()).toBe(2);
    session.release();
    // İkinci çağrı aynı kanalları tekrar durdurmaya çalışmaz.
    expect(stream.stoppedCount()).toBe(2);
  });

  it("stop() kaydedici hiç başlamamışken de akışı bırakır", async () => {
    const stream = fakeStream();
    const recorder = fakeRecorder();
    const session = new MicrophoneSession({
      openStream: async () => stream,
      createRecorder: () => recorder,
    });

    await session.start(noop, noop);
    recorder.state = "inactive"; // tarayıcı kaydı kendiliğinden bitirdi
    session.stop();
    expect(stream.stoppedCount()).toBe(2);
  });

  it("yeni kayıt öncesi önceki akış bırakılır", async () => {
    // Asıl belirti buydu: ikinci denemede mikrofonu tutan kendi sayfamızdı.
    const streams = [fakeStream(), fakeStream()];
    let index = 0;
    const session = new MicrophoneSession({
      openStream: async () => streams[index++]!,
      createRecorder: () => fakeRecorder(),
    });

    await session.start(noop, noop);
    await session.start(noop, noop);

    expect(streams[0]!.stoppedCount()).toBe(2);
    expect(streams[1]!.stoppedCount()).toBe(0);
  });

  it("onstop geri çağrısı kayıt bitince bir kez çalışır", async () => {
    const stream = fakeStream();
    let stops = 0;
    const session = new MicrophoneSession({
      openStream: async () => stream,
      createRecorder: () => fakeRecorder(),
    });

    await session.start(noop, () => {
      stops += 1;
    });
    session.stop();
    expect(stops).toBe(1);
  });

  it("release() sonrası onstop geri çağrısı çalışmaz", async () => {
    // Bileşen kapanırken bırakma yapılıyor; o sırada yarım kaydı yüklemeye
    // kalkmak sunucuya boş ses göndermek demek.
    const stream = fakeStream();
    let stops = 0;
    const recorder = fakeRecorder();
    const session = new MicrophoneSession({
      openStream: async () => stream,
      createRecorder: () => recorder,
    });

    await session.start(noop, () => {
      stops += 1;
    });
    session.release();
    expect(stops).toBe(0);
    expect(stream.stoppedCount()).toBe(2);
  });
});

describe("mikrofon hatası sınıflandırma", () => {
  it("izin reddi", () => {
    expect(classifyMicrophoneError({ name: "NotAllowedError" })).toBe("denied");
    expect(classifyMicrophoneError({ name: "SecurityError" })).toBe("denied");
  });

  it("mikrofon yok", () => {
    // Bu iki durum önce 'meşgul' ile aynı mesajı veriyordu; cihazında
    // mikrofon olmayan kullanıcı boşuna başka uygulama kapatmaya çalışıyordu.
    expect(classifyMicrophoneError({ name: "NotFoundError" })).toBe("missing");
    expect(classifyMicrophoneError({ name: "OverconstrainedError" })).toBe("missing");
  });

  it("donanım meşgul", () => {
    expect(classifyMicrophoneError({ name: "NotReadableError" })).toBe("busy");
    expect(classifyMicrophoneError({ name: "TrackStartError" })).toBe("busy");
    expect(classifyMicrophoneError({ name: "AbortError" })).toBe("busy");
  });

  it("bilinmeyen ve bozuk girdiler", () => {
    expect(classifyMicrophoneError(new Error("boom"))).toBe("unknown");
    expect(classifyMicrophoneError(null)).toBe("unknown");
    expect(classifyMicrophoneError(undefined)).toBe("unknown");
    expect(classifyMicrophoneError("metin")).toBe("unknown");
  });
});

describe("meşgul hatasında tek yeniden deneme", () => {
  function busyError() {
    const error = new Error("meşgul");
    error.name = "NotReadableError";
    return error;
  }

  it("ikinci deneme başarılıysa kayıt başlar", async () => {
    const stream = fakeStream();
    let calls = 0;
    const waits: number[] = [];
    const session = new MicrophoneSession({
      openStream: async () => {
        calls += 1;
        if (calls === 1) throw busyError();
        return stream;
      },
      createRecorder: () => fakeRecorder(),
      sleep: async (ms) => {
        waits.push(ms);
      },
    });

    await session.start(noop, noop);
    expect(calls).toBe(2);
    expect(waits).toEqual([500]);
    expect(session.active).toBe(true);
  });

  it("ikinci deneme de düşerse hata kullanıcıya çıkar", async () => {
    let calls = 0;
    const session = new MicrophoneSession({
      openStream: async () => {
        calls += 1;
        throw busyError();
      },
      createRecorder: () => fakeRecorder(),
      sleep: async () => {},
    });

    await expect(session.start(noop, noop)).rejects.toThrow("meşgul");
    // Tek yeniden deneme; döngüye girmiyor.
    expect(calls).toBe(2);
  });

  it("izin reddinde yeniden denenmez", async () => {
    // Kalıcı engelde beklemenin faydası yok, kullanıcıyı oyalar.
    let calls = 0;
    const session = new MicrophoneSession({
      openStream: async () => {
        calls += 1;
        const error = new Error("izin yok");
        error.name = "NotAllowedError";
        throw error;
      },
      createRecorder: () => fakeRecorder(),
      sleep: async () => {},
    });

    await expect(session.start(noop, noop)).rejects.toThrow("izin yok");
    expect(calls).toBe(1);
  });

  it("sleep verilmemişse eski davranış korunur", async () => {
    let calls = 0;
    const session = new MicrophoneSession({
      openStream: async () => {
        calls += 1;
        throw busyError();
      },
      createRecorder: () => fakeRecorder(),
    });

    await expect(session.start(noop, noop)).rejects.toThrow("meşgul");
    expect(calls).toBe(1);
  });
});
