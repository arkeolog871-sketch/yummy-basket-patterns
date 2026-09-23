import { describe, expect, it, vi } from "vitest";
import {
  RealtimeTurnMachine,
  formatLatency,
  sessionUpdatePayload,
  turnLatency,
  type RealtimeDeps,
} from "@/lib/realtime-voice";

// Test, geçit protokolünün ham JSON gövdesini okuyor; gevşek tip kasıtlı.
/* eslint-disable @typescript-eslint/no-explicit-any */

function machine(overrides: Partial<RealtimeDeps> = {}) {
  const sent: any[] = [];
  const phases: string[] = [];
  const errors: string[] = [];
  const logs: string[] = [];
  let clock = 0;
  const deps: RealtimeDeps = {
    mintSecret: async () => ({ token: "t", model: "gpt-realtime", callUrl: "https://x" }),
    send: (payload) => sent.push(payload),
    stopPlayback: vi.fn(),
    answerQuestion: async (question) => `cevap: ${question}`,
    onPhase: (phase) => phases.push(phase),
    onUserText: () => {},
    onAssistantText: () => {},
    onError: (message) => errors.push(message),
    now: () => (clock += 100),
    log: (line) => logs.push(line),
    voice: "coral",
    instructions: "test",
    ...overrides,
  };
  return { m: new RealtimeTurnMachine(deps), sent, phases, errors, logs, deps };
}

describe("gerçek zamanlı ses oturumu", () => {
  it("sunucu tarafı anlamsal tur algısı ve sürekli dinleme açık", () => {
    const payload = sessionUpdatePayload("coral", "talimat", "gpt-realtime") as any;
    const turn = payload.session.audio.input.turn_detection;
    // Sabit sessizlik süresi değil, cümlenin bitip bitmediğine bakan algı:
    // cümle arası duraklama yeni tur başlatmaz.
    expect(turn.type).toBe("semantic_vad");
    expect(turn.create_response).toBe(true);
    expect(turn.interrupt_response).toBe(true);
    expect(payload.session.audio.output.voice).toBe("coral");
    // İşletme bilgisi yalnız uygulamanın kendi aracından gelir.
    expect(payload.session.tools[0].name).toBe("silvan_bilgi");
  });

  it("asistan konuşurken kullanıcı araya girerse ses derhal kesilir", async () => {
    const { m, sent, deps } = machine();
    await m.handle({ type: "response.created" });
    await m.handle({ type: "output_audio_buffer.started" });
    expect(m.isSpeaking).toBe(true);

    await m.handle({ type: "input_audio_buffer.speech_started" });

    expect(deps.stopPlayback).toHaveBeenCalled();
    const types = sent.map((event) => event.type);
    // Kalan parçalar atılır VE üretilen yanıt iptal edilir.
    expect(types).toContain("output_audio_buffer.clear");
    expect(types).toContain("response.cancel");
    expect(m.isSpeaking).toBe(false);
  });

  it("asistan konuşmuyorken araya girme isteği gönderilmez", async () => {
    const { m, sent } = machine();
    await m.handle({ type: "input_audio_buffer.speech_started" });
    expect(sent).toHaveLength(0);
  });

  it("araç çağrısı uygulamanın asistanına gider ve yanıt hemen seslendirilir", async () => {
    const answerQuestion = vi.fn(async () => "Kahve diyarı açık.");
    const { m, sent } = machine({ answerQuestion });
    await m.handle({
      type: "response.function_call_arguments.done",
      name: "silvan_bilgi",
      call_id: "call_1",
      arguments: JSON.stringify({ soru: "kafe açık mı" }),
    });
    expect(answerQuestion).toHaveBeenCalledWith("kafe açık mı");
    expect(sent[0].item.call_id).toBe("call_1");
    expect(sent[0].item.output).toContain("Kahve diyarı açık.");
    // Yanıtın tamamlanması beklenmez: model hemen konuşmaya başlar.
    expect(sent[1]).toEqual({ type: "response.create" });
  });

  it("araç hatası sessizce yutulmaz, modele gerçek sebep iletilir", async () => {
    const { m, sent } = machine({
      answerQuestion: async () => {
        throw new Error("durum 502");
      },
    });
    await m.handle({
      type: "response.function_call_arguments.done",
      name: "silvan_bilgi",
      call_id: "c",
      arguments: "{}",
    });
    expect(sent[0].item.output).toContain("durum 502");
  });

  it("sağlayıcı hatası gerçek koduyla bildirilir", async () => {
    const { m, errors } = machine();
    await m.handle({ type: "error", error: { message: "invalid_audio", code: "bad_request" } });
    expect(errors[0]).toContain("bad_request");
    expect(errors[0]).toContain("invalid_audio");
    expect(errors[0]).not.toMatch(/geçici olarak yanıt vermiyor/i);
  });

  it("her turun gecikmesi ölçülür ve konsola yazılır", async () => {
    const { m, logs } = machine();
    await m.handle({ type: "input_audio_buffer.speech_started" }); // 100
    await m.handle({ type: "input_audio_buffer.speech_stopped" }); // 200
    await m.handle({ type: "input_audio_buffer.committed" }); // 300
    await m.handle({ type: "response.created" }); // 400
    await m.handle({ type: "output_audio_buffer.started" }); // 500
    await m.handle({ type: "response.done" }); // 600

    expect(logs[0]).toContain("[VOICE LATENCY]");
    expect(logs[0]).toContain("speech_end→first_audio: 300");
  });

  it("gecikme hesabı eksik damgalarda çökmez", () => {
    const latency = turnLatency({ speechStart: 0 });
    expect(latency.speechEndToFirstAudio).toBeNull();
    expect(formatLatency({ speechStart: 0 }, latency)).toContain("speech_end: —");
  });
});
