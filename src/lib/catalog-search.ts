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

/**
 * Cümle araması. Yapay zekâ kapalıyken "saç boyatmak istiyorum" gibi
 * cümleler olduğu gibi aranıyor ve hiçbir işletme çıkmıyordu (ölçüldü,
 * canlı). Cümle kelimelere bölünür, dolgu kelimeleri atılır, kalan her
 * kelime ayrı aranır; en çok kelimesi tutan işletme öne çıkar.
 */
const STOP_WORDS = new Set(
  [
    "ve",
    "ile",
    "icin",
    "bir",
    "bu",
    "su",
    "o",
    "en",
    "cok",
    "da",
    "de",
    "ki",
    "mi",
    "mu",
    "ne",
    "nerede",
    "nereden",
    "var",
    "yok",
    "istiyorum",
    "isterim",
    "istiyoruz",
    "ariyorum",
    "ariyoruz",
    "lazim",
    "gerek",
    "gerekiyor",
    "yakin",
    "yakinda",
    "yakinimda",
    "bana",
    "bize",
    "ben",
    "biz",
    "olan",
    "yapan",
    "satan",
    "hangi",
    "nasil",
    "lutfen",
    "acil",
    "simdi",
    "bugun",
    "yarin",
    "bul",
    "bulur",
    "musun",
    "misin",
    "her",
    "yer",
    "yeri",
    "yerde",
    "almak",
    "yapmak",
    "icinde",
  ].map(foldSearchText),
);

/** Aramanın anlamlı kelimeleri: katlanmış, tekil, dolgu kelimesi olmayan. */
export function searchTokens(query: string): string[] {
  const words = foldSearchText(query)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 2 && !STOP_WORDS.has(word));
  return [...new Set(words)];
}

function textWords(fields: Array<string | null | undefined>): string[] {
  return fields
    .filter((field): field is string => typeof field === "string" && field.length > 0)
    .flatMap((field) => foldSearchText(field).split(/[^\p{L}\p{N}]+/u))
    .filter((word) => word.length >= 2 && !STOP_WORDS.has(word));
}

/**
 * Kelime eşleşmesi, Türkçe eklerine dayanıklı: "kahve" → "kahveci",
 * "saçımı" → "saç". Aranan kelime metindeki kelimenin başıysa ya da metindeki
 * kelime (en az 3 harf) aranan kelimenin başıysa ve aradaki ek en çok 4
 * harfse eşleşir.
 */
export function tokenMatchesWord(token: string, word: string): boolean {
  if (word.startsWith(token)) return true;
  return word.length >= 3 && token.startsWith(word) && token.length - word.length <= 4;
}

function tokenInWords(token: string, words: string[]): boolean {
  return words.some((word) => tokenMatchesWord(token, word));
}

/**
 * Ürün adlarını veritabanında daraltmak için `ilike` deseni. Postgres
 * `ilike` aksana duyarlı: "sut" yazan "Süt"ü bulamaz. Türkçe karşılığı olan
 * harfler (c g i o s u) tek karakter jokeri `_` olur; kesin eşleşme sonra
 * `tokenMatchesWord` ile yapılır. İlk 4 harf yeterli (ekli yazımlar da gelsin).
 */
export function productIlikePattern(token: string): string {
  const head = token.slice(0, 4).replace(/[^\p{L}\p{N}]/gu, "");
  return `"%${head.replace(/[cgiosu]/g, "_")}%"`;
}

export type SearchField = { text: string | null | undefined; weight: number };

export type RankedMatch = { score: number; matched: number; products: string[] };

/**
 * Bir işletmenin aramaya uyumu. Her anlamlı kelime alanlarda (ağırlıklı) ve
 * ürün adlarında aranır. `matched` kaç kelimenin tuttuğunu söyler; hiç
 * tutmayan işletme listelenmez.
 */
export function rankSearchMatch(
  tokens: string[],
  fields: SearchField[],
  productNames: string[] = [],
): RankedMatch {
  const fieldWords = fields.map((field) => ({
    words: textWords([field.text]),
    weight: field.weight,
  }));
  const productWords = productNames.map((name) => ({ name, words: textWords([name]) }));
  let score = 0;
  let matched = 0;
  const exact: string[] = [];
  const partial: string[] = [];
  for (const token of tokens) {
    let best = 0;
    for (const field of fieldWords) {
      if (field.weight > best && tokenInWords(token, field.words)) best = field.weight;
    }
    const hits = productWords.filter((product) => tokenInWords(token, product.words));
    // Ürün satırı yalnız işletme O kelimeyle ürün sayesinde bulunduysa
    // gösterilir ("kahve" Kahve diyarı'nı adından buluyor; ürün listesi
    // gürültü olurdu). Tam kelime eşleşmesi önce: "hindi" → "Hindi Jambonlu"
    // "Hindistan Cevizli"den önce.
    if (best === 0) {
      for (const hit of hits) {
        const target = hit.words.includes(token) ? exact : partial;
        if (!exact.includes(hit.name) && !partial.includes(hit.name)) target.push(hit.name);
      }
    }
    if (hits.length > 0) best = Math.max(best, 2);
    if (best > 0) {
      score += best;
      matched += 1;
    }
  }
  return { score, matched, products: [...exact, ...partial] };
}
