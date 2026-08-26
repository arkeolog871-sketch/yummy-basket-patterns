import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { wrapDurableStorage } from "@/lib/durable-storage";
import { isIosDevice } from "@/lib/ios";

const ROOT = join(import.meta.dirname, "../..");

describe("iOS OTP input and consent", () => {
  it("keeps Android 6-slot OTP and adds a single iOS one-time-code field", () => {
    const source = readFileSync(join(ROOT, "src/components/auth/OtpCodeInput.tsx"), "utf8");
    expect(source).toContain("isIosDevice");
    expect(source).toContain("one-time-code");
    expect(source).toContain("InputOTP");
    expect(source).toContain('pattern="[0-9]*"');
    expect(source).toContain("text-[16px]");
  });

  it("does not wrap the terms checkbox in a label (iOS double-toggle)", () => {
    const source = readFileSync(
      join(ROOT, "src/components/legal/LegalConsentCheckbox.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/<label[\s>/]/);
    expect(source).toContain('type="checkbox"');
    expect(source).toContain("okudum, kabul ediyorum");
    expect(source).toContain("stopPropagation");
  });

  it("picks the iOS single field on the first client render", () => {
    const source = readFileSync(join(ROOT, "src/components/auth/OtpCodeInput.tsx"), "utf8");
    expect(source).toContain("useState(() => isIosDevice())");
    expect(source).not.toContain("setIos(isIosDevice())");
  });

  it("detects iPhone user agents and not Android", () => {
    const original = globalThis.navigator;
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", platform: "iPhone", maxTouchPoints: 5 },
    });
    expect(isIosDevice()).toBe(true);
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7)", platform: "Linux", maxTouchPoints: 5 },
    });
    expect(isIosDevice()).toBe(false);
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: original });
  });
});

describe("durable auth storage", () => {
  it("reads and writes through localStorage when available", () => {
    const map = new Map<string, string>();
    const inner = {
      get length() {
        return map.size;
      },
      clear() {
        map.clear();
      },
      key(i: number) {
        return [...map.keys()][i] ?? null;
      },
      getItem(key: string) {
        return map.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        map.set(key, value);
      },
      removeItem(key: string) {
        map.delete(key);
      },
    } as Storage;
    const store = wrapDurableStorage(inner);
    store.setItem("sb-test-auth-token", "present");
    expect(store.getItem("sb-test-auth-token")).toBe("present");
    store.removeItem("sb-test-auth-token");
    expect(store.getItem("sb-test-auth-token")).toBeNull();
  });

  it("keeps a memory copy if Storage throws like iOS private mode", () => {
    const inner = {
      get length() {
        throw new Error("quota");
      },
      clear() {
        throw new Error("quota");
      },
      key() {
        throw new Error("quota");
      },
      getItem() {
        throw new Error("quota");
      },
      setItem() {
        throw new Error("quota");
      },
      removeItem() {
        throw new Error("quota");
      },
    } as unknown as Storage;
    const store = wrapDurableStorage(inner);
    store.setItem("sb-test-auth-token", "memory");
    expect(store.getItem("sb-test-auth-token")).toBe("memory");
  });
});
