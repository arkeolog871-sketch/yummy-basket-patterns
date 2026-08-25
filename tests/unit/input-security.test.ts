import { describe, expect, it } from "vitest";
import { escapeHtml } from "@/lib/escape-html";
import { ilikePattern } from "@/lib/catalog-search";

describe("XSS / injection input hardening", () => {
  it("escapes HTML and script payloads for map popups", () => {
    const payload = `<img src=x onerror=alert(1)>'"&`;
    const escaped = escapeHtml(payload);
    expect(escaped).not.toContain("<img");
    expect(escaped).toContain("&lt;img");
    expect(escaped).toContain("&quot;");
    expect(escaped).toContain("&#039;");
    expect(escaped).toContain("&amp;");
  });

  it("strips PostgREST wildcard and clause breakers from search", () => {
    expect(ilikePattern("%_")).toBeNull();
    expect(ilikePattern("pizza,name.eq.hack")).toBe('"%pizza name.eq.hack%"');
    expect(ilikePattern('foo"bar')).toBe('"%foo\\"bar%"');
    expect(ilikePattern("kebap")).toBe('"%kebap%"');
  });

  it("handles unicode and oversized search by trimming injection meta", () => {
    expect(ilikePattern("şüğ")).toBe('"%şüğ%"');
    const huge = `${"a".repeat(80)}%)(eq`;
    const pattern = ilikePattern(huge);
    expect(pattern).toBeTruthy();
    expect(pattern).not.toContain("%)(");
    expect(pattern?.startsWith('"%')).toBe(true);
    expect(pattern?.endsWith('%"')).toBe(true);
  });
});
