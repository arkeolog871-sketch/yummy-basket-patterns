import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildProductDescriptionPrompt, cleanProductDescription } from "./product-description";

/** İşletme sahibi için OpenAI ile kısa ürün açıklaması üretir. Anahtar yalnız sunucuda. */
export const writeProductDescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ name: z.string().trim().min(2).max(120) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertVendor } = await import("./vendor.server");
    const restaurantId = await assertVendor(context.supabase, context.userId);
    const { data: biz } = await context.supabase
      .from("restaurants")
      .select("name")
      .eq("id", restaurantId)
      .maybeSingle();

    const key = process.env["OPENAI_API_KEY"];
    if (!key) throw new Error("Yapay zekâ şu an kullanılamıyor.");

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 160,
        temperature: 0.8,
        messages: [{ role: "user", content: buildProductDescriptionPrompt(data.name, biz?.name) }],
      }),
    });
    if (!res.ok) {
      console.error("[product-description] OpenAI", res.status, await res.text().catch(() => ""));
      if (res.status === 429) throw new Error("Yapay zekâ kullanım sınırına ulaştı, biraz sonra deneyin.");
      throw new Error("Açıklama şu an yazılamadı, lütfen tekrar deneyin.");
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = cleanProductDescription(json.choices?.[0]?.message?.content ?? "");
    if (!text) throw new Error("Açıklama şu an yazılamadı, lütfen tekrar deneyin.");
    return { description: text };
  });
