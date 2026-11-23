/** Ürün açıklaması yazıcısı için saf yardımcılar (istemci güvenli). */
export const PRODUCT_DESCRIPTION_MAX_CHARS = 200;

export function buildProductDescriptionPrompt(name: string, businessName?: string | null): string {
  const where = businessName?.trim() ? ` "${businessName.trim()}" işletmesinin` : "";
  return `Yerel bir pazaryerinde${where} sattığı "${name.trim()}" ürünü için Türkçe, sıcak ve iştah/ilgi uyandıran, tek paragraf, en fazla ${PRODUCT_DESCRIPTION_MAX_CHARS} karakterlik kısa bir açıklama yaz. Fiyat, indirim, emin olmadığın içerik veya abartılı sağlık iddiası yazma. Yalnız açıklamayı döndür, tırnak kullanma.`;
}

export function cleanProductDescription(raw: string): string {
  let text = raw.trim().replace(/^["“”']+|["“”']+$/g, "").replace(/\s+/g, " ").trim();
  if (text.length > PRODUCT_DESCRIPTION_MAX_CHARS) {
    const cut = text.slice(0, PRODUCT_DESCRIPTION_MAX_CHARS);
    const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "));
    text = lastStop > 60 ? cut.slice(0, lastStop + 1) : cut.replace(/\s+\S*$/, "") + "…";
  }
  return text;
}
