/** PostgREST `or`/`ilike` için güvenli desen — virgül veya joker karakter aramayı bozmasın. */
export function ilikePattern(raw: string): string | null {
  const escaped = raw
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/[%_]/g, "")
    .replace(/[,()]/g, " ")
    .trim();
  if (!escaped) return null;
  return `"%${escaped}%"`;
}

/**
 * Türkçe arama katlaması. Telefonda çoğu kullanıcı "kuafor", "nursin",
 * "sofor" diye aksansız yazıyor; Postgres `ilike` bunları eşleştirmediği için
 * arama boş dönüyordu. Küçük harfe çevirirken Türkçe kuralı uygulanır
 * ("I" → "ı", "İ" → "i"), sonra aksanlar sadeleştirilir.
 */
const TURKISH_FOLD: Record<string, string> = {
  ç: "c",
  ğ: "g",
  ı: "i",
  ö: "o",
  ş: "s",
  ü: "u",
  â: "a",
  î: "i",
  û: "u",
};

export function foldSearchText(value: string): string {
  return value
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşüâîû]/g, (char) => TURKISH_FOLD[char] ?? char)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/** Boşlukla ayrılan her terim, alanlardan birinde geçmelidir. */
export function matchesSearchTerms(
  fields: Array<string | null | undefined>,
  query: string,
): boolean {
  const needle = foldSearchText(query);
  if (!needle) return true;
  const haystack = fields
    .filter((field): field is string => typeof field === "string" && field.length > 0)
    .map(foldSearchText)
    .join(" ");
  return needle.split(/\s+/).every((term) => haystack.includes(term));
}
