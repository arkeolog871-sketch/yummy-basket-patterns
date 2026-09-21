import { describe, expect, it } from "vitest";
import { readWebPage } from "../../src/lib/web-research.server";

describe("web-research güvenlik kapıları", () => {
  it("işletme rehberi adreslerini reddeder", async () => {
    const result = await readWebPage("https://www.yemeksepeti.com/istanbul");
    expect(result).toHaveProperty("error");
  });

  it("yerel/iç adresleri reddeder", async () => {
    expect(await readWebPage("http://localhost:8080/")).toHaveProperty("error");
    expect(await readWebPage("http://127.0.0.1/")).toHaveProperty("error");
    expect(await readWebPage("file:///etc/passwd")).toHaveProperty("error");
  });

  it("geçersiz adresi reddeder", async () => {
    expect(await readWebPage("not-a-url")).toHaveProperty("error");
  });
});
