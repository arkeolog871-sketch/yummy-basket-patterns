/**
 * Asistan sohbet geçmişi — veritabanında kalıcı saklama.
 *
 * Giriş yapmış kullanıcının sohbeti assistant_messages tablosunda tutulur, bu
 * sayede sayfa yenilendiğinde veya başka cihazdan girildiğinde geçmiş kaybolmaz.
 * Giriş yapılmamışsa sohbet yalnızca cihazda (localStorage) kalır.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const MAX_ROWS = 60;

const appendSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(4000),
        proposal: z.unknown().nullish(),
      }),
    )
    .min(1)
    .max(4),
});

export const listAssistantHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("assistant_messages")
      .select("id, role, content, proposal, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(MAX_ROWS);
    if (error) throw new Error(error.message);
    return (data ?? []).slice().reverse();
  });

export const appendAssistantHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => appendSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Aynı istekte gelen mesajlar sırayı korusun: created_at milisaniye kaydırılır.
    const base = Date.now();
    const rows = data.messages.map((message, index) => ({
      user_id: context.userId,
      role: message.role,
      content: message.content,
      proposal: (message.proposal ?? null) as never,
      created_at: new Date(base + index).toISOString(),
    }));
    const { error } = await context.supabase.from("assistant_messages").insert(rows);
    if (error) throw new Error(error.message);
    return { saved: rows.length };
  });

export const clearAssistantHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("assistant_messages")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { cleared: true };
  });
