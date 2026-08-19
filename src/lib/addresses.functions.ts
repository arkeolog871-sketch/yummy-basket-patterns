import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const addressSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().min(1).max(40),
  recipient_name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(7).max(25),
  city: z.string().trim().min(2).max(60),
  district: z.string().trim().min(2).max(60),
  street: z.string().trim().min(4).max(200),
  directions: z.string().trim().max(300).optional().nullable(),
  is_default: z.boolean().optional(),
});

export const listAddresses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("addresses")
      .select("*")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => addressSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = {
      label: data.label,
      recipient_name: data.recipient_name,
      phone: data.phone,
      city: data.city,
      district: data.district,
      street: data.street,
      directions: data.directions ?? null,
      is_default: data.is_default ?? false,
      user_id: userId,
    };

    if (payload.is_default) {
      await supabase.from("addresses").update({ is_default: false }).eq("user_id", userId);
    }

    if (data.id) {
      const { error } = await supabase.from("addresses").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }

    const { data: inserted, error } = await supabase
      .from("addresses")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id };
  });

export const deleteAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("addresses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });