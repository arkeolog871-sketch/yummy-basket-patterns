import { foldSearchText, tokenMatchesWord } from "./catalog-search";

/**
 * Kategori arama motoru (işletme başvurusu + Sayfa Yöneticisi Paneli).
 *
 * Sıralama, güçlüden zayıfa:
 * 1. Adın tamamı ("kasap")
 * 2. Adın başı ("kas" → Kasap)
 * 3. Eş anlamlının tamamı / başı ("dişçi" → Diş kliniği, "keratin" → Kadın kuaförü)
 * 4. Kelime kelime eşleşme: her kelime adda, eş anlamlılarda ya da grupta
 *    geçmeli. Kelime başı, Türkçe ek ("kuaförler" → kuaför), kelime içi ve
 *    yazım hatası (1–2 harf: "elektirikçi", "berbr") ayrı puan alır.
 *
 * Yakın anlamlılar: "tamir/onarım/servis", "oto/araba/araç" gibi kelimeler
 * birbirinin yerine sayılır. Aksanlar yok sayılır ("kuafor" = "kuaför").
 */

export type SearchableCategory = {
  slug: string;
  name: string;
  group_name: string;
  synonyms: string[];
  position?: number;
};

export type CategorySearchResult<T extends SearchableCategory> = {
  entry: T;
  score: number;
  /** Eşleşme addan değil eş anlamlıdan geldiyse o ifade (ekranda ipucu). */
  via: string | null;
};

/** Birbirinin yerine aranabilen kelimeler (katlanmış yazımla). */
const NEAR_WORDS: readonly (readonly string[])[] = [
  ["tamir", "tamirci", "onarim", "servis"],
  ["oto", "araba", "arac", "otomobil"],
  ["doktor", "hekim", "hekimi", "klinik", "klinigi", "muayenehane"],
  ["kurs", "kursu", "ders", "egitim", "okul", "okulu"],
  ["magaza", "magazasi", "dukkan", "dukkani", "satis", "satici", "bayi", "bayii"],
  ["kuafor", "kuaforu", "sac"],
  ["yemek", "lokanta", "restoran"],
  ["kafe", "cafe", "kafeterya"],
  ["cocuk", "bebek"],
  ["kadin", "bayan"],
  ["telefon", "cep"],
  ["bilgisayar", "laptop", "pc"],
  ["temizlik", "temizlikci", "yikama"],
  ["tasima", "nakliye", "nakliyat", "tasimacilik"],
  ["kiralama", "kiralik", "kira"],
  ["hayvan", "pet", "evcil"],
];

const NEAR_INDEX = new Map<string, readonly string[]>();
for (const set of NEAR_WORDS) for (const word of set) NEAR_INDEX.set(word, set);

/** "doktoru", "tamirci" gibi ekli yazımlar da yakın anlam kümesini bulsun. */
function nearAlternatives(token: string): readonly string[] {
  const direct = NEAR_INDEX.get(token);
  if (direct) return direct;
  for (const [word, set] of NEAR_INDEX) {
    if (word.length >= 4 && tokenMatchesWord(token, word)) return [token, ...set];
  }
  return [token];
}

/** Katlanmış yazımda meslek/yer ekleri: kahve+ci, kuyum+cu, sut+cu+luk. */
const PROFESSION_SUFFIX = /^(ci|cu|cilik|culuk|lik|luk|ciler|culer)$/;

/** Aramada anlam taşımayan bağlaçlar. */
const FILLER = new Set(["ve", "ile", "icin", "veya", "ya", "da", "de"]);

function words(value: string): string[] {
  return foldSearchText(value)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 0 && !FILLER.has(word));
}

/** Damerau–Levenshtein (bitişik harf yer değişimi 1 sayılır), üst sınırlı. */
let rowA = new Int32Array(0);
let rowB = new Int32Array(0);
let rowC = new Int32Array(0);
function editDistance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  const cols = b.length + 1;
  if (rowA.length < cols) {
    rowA = new Int32Array(cols * 2);
    rowB = new Int32Array(cols * 2);
    rowC = new Int32Array(cols * 2);
  }
  // rowC: iki önceki satır, rowA: önceki, rowB: şimdiki
  for (let j = 0; j < cols; j++) rowA[j] = j;
  for (let i = 1; i <= a.length; i++) {
    rowB[0] = i;
    let rowMin = i;
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(rowA[j]! + 1, rowB[j - 1]! + 1, rowA[j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, rowC[j - 2]! + 1);
      }
      rowB[j] = value;
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > limit) return limit + 1;
    const spare = rowC;
    rowC = rowA;
    rowA = rowB;
    rowB = spare;
  }
  return rowA[b.length]!;
}

/** Yazım hatası payı: kısa kelimede hata kabul edilmez (yanlış eşleşme çok olur). */
function typoLimit(token: string): number {
  if (token.length >= 7) return 2;
  if (token.length >= 4) return 1;
  return 0;
}

/**
 * Bir arama kelimesinin tek bir metin kelimesine uyum gücü (0 = uymuyor).
 * 10 tam, 8 baştan, 7 Türkçe ekli, 4 kelime içi, 3–2 yazım hatası.
 */
function wordStrength(token: string, word: string, fuzzy: boolean): number {
  if (word === token) return 10;
  if (word.startsWith(token)) return 8;
  if (!fuzzy) return 0;
  // Türkçe ek: "kuaforler" → "kuafor" (metindeki kelime en az 4 harf; "kas"
  // gibi kısa kelimeler "kasap"ı yakalamasın)
  if (word.length >= 4 && tokenMatchesWord(token, word)) return 7;
  if (token.length >= 3 && word.includes(token)) return 4;
  const limit = typoLimit(token);
  // İlk harf hatası nadirdir; aynı ilk harf şartı hem yanlış eşleşmeyi hem
  // hesap yükünü büyük ölçüde azaltır.
  if (limit > 0 && word.length >= 3 && word[0] === token[0]) {
    // Yazarken yarım kalan kelimede hata da olabilir: "elektiri" → "elektrikci"
    const head = word.slice(0, token.length);
    const distance = Math.min(editDistance(token, word, limit), editDistance(token, head, limit));
    if (distance <= limit) return distance === 1 ? 3 : 2;
  }
  return 0;
}

function bestStrength(
  token: string,
  targetWords: readonly string[],
  fuzzy: boolean,
  near: boolean,
): number {
  // Yakın anlamlılar yalnız adda aranır ("araba" → "Oto tamir servisi");
  // eş anlamlılarda da aranınca "nakliyat" → "numara taşıma" gibi gürültü çıkıyordu.
  const alternatives = near ? nearAlternatives(token) : [token];
  let best = 0;
  for (const alternative of alternatives) {
    // Yakın anlamlı kelime asıl kelimeden biraz zayıf sayılır.
    const discount = alternative === token ? 0 : 2;
    for (const word of targetWords) {
      // Yakın anlamlı kelimede yalnız tam/baştan eşleşme: yazım hatası payı
      // eş anlam üstüne binince alakasız sonuç çok çıkıyordu.
      const strength = wordStrength(alternative, word, fuzzy && alternative === token);
      if (strength > 0) best = Math.max(best, strength - discount);
    }
  }
  return best;
}

type Indexed<T extends SearchableCategory> = {
  entry: T;
  name: string;
  nameWords: string[];
  synonyms: { text: string; folded: string; words: string[] }[];
  groupWords: string[];
};

const indexCache = new WeakMap<readonly SearchableCategory[], Indexed<SearchableCategory>[]>();

function buildIndex<T extends SearchableCategory>(catalog: readonly T[]): Indexed<T>[] {
  const cached = indexCache.get(catalog);
  if (cached) return cached as Indexed<T>[];
  const index = catalog.map((entry) => ({
    entry,
    name: foldSearchText(entry.name),
    nameWords: words(entry.name),
    synonyms: entry.synonyms.map((text) => ({
      text,
      folded: foldSearchText(text),
      words: words(text),
    })),
    groupWords: words(entry.group_name),
  }));
  indexCache.set(catalog, index as Indexed<SearchableCategory>[]);
  return index;
}

/**
 * Eşleşme katmanı. Ekranda en iyi katman(lar) gösterilir, zayıf katman
 * yalnız daha iyisi yoksa devreye girer: "kasap" yazana "Kirpik ve kaş"
 * (yazım hatası payıyla) ya da "emlak" yazana aynı gruptaki "Döviz bürosu"
 * gösterilmez.
 *   3: ifadenin tamamı adın ya da bir eş anlamlının başı
 *   2: her kelime ad/eş anlamlılarda tam ya da baştan tutuyor
 *   1: ekli yazım, kelime içi, yazım hatası ya da grup adıyla tutuyor
 */
type Hit = { tier: 1 | 2 | 3; score: number; via: string | null };

function scoreEntry<T extends SearchableCategory>(
  item: Indexed<T>,
  phrase: string,
  tokens: string[],
  fuzzy: boolean,
): Hit | null {
  if (item.name === phrase) return { tier: 3, score: 1000, via: null };
  // Eşit güçte eşleşmelerde katalog sırası (her grupta en yaygın olan önce).
  const order = (item.entry.position ?? 0) / 1000;
  // Tam kelime ("su" → "Su bayii") yarım kelimeden ("Sütlü tatlıcı") önce.
  // Meslek eki tam kelime sayılır: "kahve" → "Kahveci", "Kahve ve çay dükkanı"
  // ile eşit; aralarında katalog sırası (yaygın olan önce) belirler.
  const firstWord = item.nameWords[0] ?? "";
  if (
    item.name.startsWith(`${phrase} `) ||
    item.name === phrase ||
    (firstWord.startsWith(phrase) && PROFESSION_SUFFIX.test(firstWord.slice(phrase.length)))
  ) {
    return { tier: 3, score: 950 - order, via: null };
  }
  if (item.name.startsWith(phrase)) return { tier: 3, score: 900 - order, via: null };

  let synonymHit: Hit | null = null;
  for (const synonym of item.synonyms) {
    if (synonym.folded === phrase) {
      synonymHit = { tier: 3, score: 800, via: synonym.text };
      break;
    }
    if (synonym.folded.startsWith(phrase) && (!synonymHit || synonymHit.score < 700)) {
      synonymHit = { tier: 3, score: 700 - order, via: synonym.text };
    }
  }
  if (synonymHit) return synonymHit;

  // Kelime kelime: her kelime bir yerde tutmalı.
  let total = 0;
  let weakest = 10;
  let viaSynonym: string | null = null;
  let fromName = 0;
  let groupOnly = false;
  for (const token of tokens) {
    // 1–2 harfli kelime yalnız ad kelimelerinin başında aranır ("su" →
    // "Su bayii"); eş anlamlılarda ararsak yüzlerce yarım eşleşme çıkıyor.
    const short = token.length <= 2;
    const inName = bestStrength(token, item.nameWords, fuzzy && !short, true);
    let inSynonym = 0;
    let synonymText: string | null = null;
    if (!short) {
      for (const synonym of item.synonyms) {
        const strength = bestStrength(token, synonym.words, fuzzy, false);
        if (strength > inSynonym) {
          inSynonym = strength;
          synonymText = synonym.text;
        }
      }
    }
    const best = Math.max(inName, inSynonym);
    if (best === 0) {
      // Grup adı yalnız tam kelime olarak ve zayıf katmanda: "otomotiv" →
      // Otomotiv grubundaki her şey (adında "otomotiv" geçen yok).
      if (!fuzzy || short || !item.groupWords.includes(token)) return null;
      groupOnly = true;
      // Grup adının tam tutması, yazım hatası payıyla bulunan eşleşmeden önde.
      total += 40;
      weakest = 0;
      continue;
    }
    weakest = Math.min(weakest, best);
    // Ad en değerli, sonra eş anlamlı.
    const weighted = Math.max(inName * 6, inSynonym * 4);
    total += weighted;
    if (inName > 0 && inName * 6 >= weighted) fromName++;
    else if (!viaSynonym) viaSynonym = synonymText;
  }
  const tier = !groupOnly && weakest >= 8 ? 2 : 1;
  // Adında aramayla ilgisiz kelime kalmayan kayıt daha isabetli:
  // "elektrikci" → "Elektrikçi", "Oto elektrikçi"den önce.
  const unmatched = item.nameWords.filter(
    (word) => !tokens.some((token) => wordStrength(token, word, fuzzy) > 0),
  ).length;
  // Yalnız grup adıyla bulunanlarda ad zaten tutmuyor; katalog sırası kalsın.
  if (!groupOnly) total -= unmatched * 3;
  // Addan tutan her kelime ayrıca öne alır; kısa ad (daha genel) biraz önde.
  const score = total + fromName * 10 - order;
  return { tier, score, via: fromName === tokens.length ? null : viaSynonym };
}

function rank<T extends SearchableCategory>(
  index: Indexed<T>[],
  phrase: string,
  tokens: string[],
  fuzzy: boolean,
): (CategorySearchResult<T> & { tier: number })[] {
  const hits: (CategorySearchResult<T> & { tier: number })[] = [];
  for (const item of index) {
    const hit = scoreEntry(item, phrase, tokens, fuzzy);
    if (hit) hits.push({ entry: item.entry, score: hit.score, via: hit.via, tier: hit.tier });
  }
  return hits;
}

/**
 * Anlık arama. Boş sorguda boş liste döner (çağıran taraf öneri gösterir).
 * Önce yalnız tam/baştan eşleşmelerle aranır; hiçbiri yoksa ekli yazım,
 * yazım hatası ve grup adı devreye girer.
 */
export function searchCategories<T extends SearchableCategory>(
  catalog: readonly T[],
  query: string,
  limit = 12,
): CategorySearchResult<T>[] {
  const phrase = foldSearchText(query).replace(/\s+/g, " ").trim();
  if (!phrase) return [];
  const tokens = [...new Set(words(phrase))];
  if (tokens.length === 0) return [];
  const index = buildIndex(catalog);
  let hits = rank(index, phrase, tokens, false);
  if (hits.length === 0) {
    const loose = rank(index, phrase, tokens, true);
    const bestTier = Math.max(0, ...loose.map((hit) => hit.tier));
    hits = loose.filter((hit) => hit.tier === bestTier);
  }
  if (hits.length === 0 && tokens.length > 1) {
    // Son çare: kelimelerin bir kısmı tutanlar. "kuaför salonu" → "salonu"
    // hiçbir kuaför kaydında yok ama "kuaför" tutuyor. Her kelime ne kadar
    // ayırt ediciyse o kadar ağır sayılır: "salonu" onlarca kategoride
    // geçtiği için "Oyun salonu"nu öne çıkaramaz.
    const perToken = tokens.map((token) =>
      index.map((item) => {
        const hit = scoreEntry(item, token, [token], false);
        return hit !== null && hit.tier >= 2;
      }),
    );
    const weights = perToken.map((flags) => {
      const matches = flags.filter(Boolean).length;
      return matches === 0 ? 0 : Math.log(1 + index.length / matches);
    });
    const partial = index
      .map((item, i) => ({
        item,
        weight: tokens.reduce((sum, _, t) => sum + (perToken[t]![i] ? weights[t]! : 0), 0),
      }))
      .filter((row) => row.weight > 0);
    const best = Math.max(0, ...partial.map((row) => row.weight));
    hits = partial
      .filter((row) => row.weight >= best * 0.75)
      .map((row) => ({
        entry: row.item.entry,
        score: row.weight * 100 - (row.item.entry.position ?? 0) / 1000,
        via: null,
        tier: 0,
      }));
  }
  hits.sort(
    (a, b) =>
      b.tier - a.tier ||
      b.score - a.score ||
      (a.entry.position ?? 0) - (b.entry.position ?? 0) ||
      a.entry.name.localeCompare(b.entry.name, "tr"),
  );
  return hits.slice(0, limit).map(({ entry, score, via }) => ({ entry, score, via }));
}

/** Yazılan metin katalogdaki bir adla aynı mı (aksan/büyük harf farkı yok sayılır)? */
export function findExactCategory<T extends SearchableCategory>(
  catalog: readonly T[],
  value: string,
): T | null {
  const folded = foldSearchText(value);
  if (!folded) return null;
  return catalog.find((entry) => foldSearchText(entry.name) === folded) ?? null;
}
