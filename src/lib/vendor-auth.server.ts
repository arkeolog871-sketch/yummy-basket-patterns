import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Telefonu yalnızca rakamlara indirger ve son 10 haneyi (yerel numara) döner. */
export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

/** E-postayı kısmen gizler: ar****@gmail.com */
export function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!name || !domain) return "•••";
  const visible = name.slice(0, 2);
  return `${visible}${"•".repeat(Math.max(3, name.length - 2))}@${domain}`;
}

/** Sunucu tarafı publishable (anon) istemcisi; oturum saklamaz. */
export function createServerPublicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

/** Girdinin e-posta olup olmadığını anlar. */
export function isEmailIdentifier(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.trim());
}

/**
 * Telefon numarası veya e-posta adresine karşılık gelen işletme kullanıcısını bulur.
 * E-posta, müşteri girişinde kullanılan hesabın aynısıdır.
 */
export async function findVendorUser(
  identifier: string,
): Promise<{ userId: string; email: string } | null> {
  const raw = identifier.trim();
  const byEmail = isEmailIdentifier(raw);
  const target = byEmail ? raw.toLowerCase() : normalizePhone(raw);
  if (!byEmail && target.length < 10) return null;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: assignments, error } = await supabaseAdmin
    .from("vendor_assignments")
    .select("user_id");
  if (error) throw new Error(error.message);
  const vendorIds = (assignments ?? []).map((row) => row.user_id);
  if (vendorIds.length === 0) return null;

  if (byEmail) {
    for (const id of vendorIds) {
      const { data: user } = await supabaseAdmin.auth.admin.getUserById(id);
      const email = user.user?.email ?? null;
      if (email && email.toLowerCase() === target) return { userId: id, email };
    }
    return null;
  }

  const { data: profiles, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, phone")
    .in("id", vendorIds);
  if (profileError) throw new Error(profileError.message);

  const match = (profiles ?? []).find(
    (row) => row.phone && normalizePhone(row.phone) === target,
  );
  if (!match) return null;

  const { data: user, error: userError } = await supabaseAdmin.auth.admin.getUserById(match.id);
  if (userError) throw new Error(userError.message);
  const email = user.user?.email ?? null;
  if (!email) return null;

  return { userId: match.id, email };
}