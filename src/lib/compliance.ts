/** Tarayıcı ve sunucuda ortak, saf uyum yardımcıları. */

export type PlatformIdentity = {
  legal_name?: string | null;
  brand_name?: string | null;
  mersis_no?: string | null;
  tax_office?: string | null;
  tax_no?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  kep_address?: string | null;
  kvkk_contact?: string | null;
  authorized_person?: string | null;
};

export const IDENTITY_LABELS: Record<keyof PlatformIdentity, string> = {
  legal_name: "Ticari unvan / ad-soyad",
  brand_name: "Marka",
  mersis_no: "MERSİS no (varsa)",
  tax_office: "Vergi dairesi",
  tax_no: "Vergi / TC kimlik no",
  address: "Açık adres",
  phone: "Telefon",
  email: "E-posta",
  kep_address: "KEP adresi",
  kvkk_contact: "KVKK başvuru adresi",
  authorized_person: "Yetkili kişi",
};

/** Yasal sayfaların "yayına hazır" sayılması için zorunlu alanlar (MERSİS isteğe bağlı). */
export const REQUIRED_IDENTITY_FIELDS: (keyof PlatformIdentity)[] = [
  "legal_name",
  "address",
  "phone",
  "email",
  "kvkk_contact",
];

export function identityMissingFields(identity: PlatformIdentity): string[] {
  const id = { ...identity, kvkk_contact: identity.kvkk_contact || identity.email };
  return REQUIRED_IDENTITY_FIELDS.filter((key) => !String(id[key] ?? "").trim()).map(
    (key) => IDENTITY_LABELS[key],
  );
}

/** Yayına alma için zorunlu belgeler eksik ya da süresi dolmuş mu? */
export function businessPublishBlockers(
  required: string[],
  documents: { doc_kind: string; status: string; expires_at: string | null }[],
  today = new Date().toISOString().slice(0, 10),
): string[] {
  return required.filter(
    (kind) =>
      !documents.some(
        (doc) =>
          doc.doc_kind === kind &&
          doc.status === "approved" &&
          (!doc.expires_at || doc.expires_at >= today),
      ),
  );
}

/** Pazarlama gönderimi yalnız son kaydın açık izin olduğu kanala yapılabilir. */
export function marketingAllowed(
  history: { channel: string; granted: boolean; created_at: string }[],
  channel: string,
): boolean {
  const latest = history
    .filter((row) => row.channel === channel)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  return latest?.granted === true;
}

/** Tekrar gelen ödeme olayı aynı anahtarla ikinci kez işlenmez. */
export function isDuplicatePaymentEvent(seenKeys: Set<string>, key: string): boolean {
  if (seenKeys.has(key)) return true;
  seenKeys.add(key);
  return false;
}
