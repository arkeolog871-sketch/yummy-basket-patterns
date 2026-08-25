import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runServerFn } from "./public-error";
import {
  isMissingAdvertisementsSchema,
  isMissingAdvertisementsTable,
  parseActionType,
  parseAdvertisement,
  sanitizeActionValue,
  type AdActionType,
} from "@/lib/advertisements";

const MISSING =
  "advertisements tablosu henüz yok. Kurucu Paneli’ndeki SQL’i Supabase SQL Editor’da bir kez çalıştırın.";

const saveSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(120),
  client_name: z.string().trim().max(80).default(""),
  client_phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^$|^[0-9+()\s-]{10,30}$/, "Geçerli bir telefon girin")
    .default(""),
  image_url: z.string().trim().min(4).max(500),
  action_type: z.enum(["phone", "internal_route", "external_link"]),
  action_value: z.string().trim().min(1).max(500),
  display_order: z.number().int().min(0).max(9999).default(0),
  is_active: z.boolean().default(true),
  start_date: z.string().trim().min(10).max(40),
  end_date: z.string().trim().min(10).max(40),
});

export const listAdvertisements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    runServerFn(async () => {
      const { assertFounder } = await import("./founder.server");
      await assertFounder(context.supabase, context.userId, context.claims as never);
      const { data, error } = await context.supabase
        .from("advertisements")
        .select("*")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) {
        if (isMissingAdvertisementsTable(error) || isMissingAdvertisementsSchema(error)) {
          return { items: [], schemaMissing: true as const };
        }
        throw new Error(error.message);
      }
      await context.supabase.rpc("expire_stale_advertisements");
      const items = (data ?? [])
        .map((row) => parseAdvertisement(row))
        .filter((row) => row != null);
      return { items, schemaMissing: false as const };
    }),
  );

export const saveAdvertisement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => {
    const data = saveSchema.parse(input);
    const action_type = parseActionType(data.action_type) as AdActionType;
    const action_value = sanitizeActionValue(action_type, data.action_value);
    if (!action_value) {
      throw new Error("Aksiyon hedefi geçersiz (telefon, /rota veya https:// bağlantı).");
    }
    const start = new Date(data.start_date);
    const end = new Date(data.end_date);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      throw new Error("Bitiş tarihi başlangıçtan sonra olmalıdır.");
    }
    return {
      ...data,
      action_type,
      action_value,
      start_date: start.toISOString(),
      end_date: end.toISOString(),
    };
  })
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      const { assertFounder } = await import("./founder.server");
      const { audited } = await import("./audit.server");
      await assertFounder(context.supabase, context.userId, context.claims as never);
      const { id, ...values } = data;
      return audited(
        {
          actorId: context.userId,
          actorEmail: (context.claims as { email?: string } | null)?.email ?? null,
          action: id ? "advertisement.update" : "advertisement.create",
          entity: "advertisements",
          entityId: id ?? null,
          detail: { title: values.title, action_type: values.action_type },
        },
        async () => {
          if (id) {
            const { error } = await context.supabase.from("advertisements").update(values).eq("id", id);
            if (error) {
              if (isMissingAdvertisementsSchema(error)) throw new Error(MISSING);
              throw new Error(error.message);
            }
            return { ok: true, id };
          }
          const { data: inserted, error } = await context.supabase
            .from("advertisements")
            .insert(values)
            .select("id")
            .maybeSingle();
          if (error) {
            if (isMissingAdvertisementsSchema(error)) throw new Error(MISSING);
            throw new Error(error.message);
          }
          return { ok: true, id: inserted?.["id"] ?? null };
        },
      );
    }),
  );

export const setAdvertisementActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      const { assertFounder } = await import("./founder.server");
      const { audited } = await import("./audit.server");
      await assertFounder(context.supabase, context.userId, context.claims as never);
      return audited(
        {
          actorId: context.userId,
          actorEmail: (context.claims as { email?: string } | null)?.email ?? null,
          action: "advertisement.toggle",
          entity: "advertisements",
          entityId: data.id,
          detail: { is_active: data.is_active },
        },
        async () => {
          const { error } = await context.supabase
            .from("advertisements")
            .update({ is_active: data.is_active })
            .eq("id", data.id);
          if (error) {
            if (isMissingAdvertisementsSchema(error)) throw new Error(MISSING);
            throw new Error(error.message);
          }
          return { ok: true };
        },
      );
    }),
  );

export const deleteAdvertisement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) =>
    runServerFn(async () => {
      const { assertFounder } = await import("./founder.server");
      const { audited } = await import("./audit.server");
      await assertFounder(context.supabase, context.userId, context.claims as never);
      return audited(
        {
          actorId: context.userId,
          actorEmail: (context.claims as { email?: string } | null)?.email ?? null,
          action: "advertisement.delete",
          entity: "advertisements",
          entityId: data.id,
        },
        async () => {
          const { error } = await context.supabase.from("advertisements").delete().eq("id", data.id);
          if (error) {
            if (isMissingAdvertisementsSchema(error)) throw new Error(MISSING);
            throw new Error(error.message);
          }
          return { ok: true };
        },
      );
    }),
  );
