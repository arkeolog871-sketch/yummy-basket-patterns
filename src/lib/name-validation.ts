/**
 * "Ad soyad" alanlarında argo/küfür ve gerçek dışı (klavye karması, test
 * değeri) girişleri eler. Mükemmel bir doğrulama hedeflenmiyor — yanlış bir
 * ret, eksik veriden daha kötüdür. Yalnızca açıkça insan ismi OLAMAYACAK
 * girdiler reddedilir; nadir/yabancı ama gerçek isimler bazen yanlışlıkla
 * takılabilir, kullanıcı farklı yazımla tekrar dener.
 */

/** Yalnızca Türkçe/Latin harfler, kesme işareti ve tire — rakam/sembol/emoji yok. */
const LETTERS_ONLY = /^[a-zA-ZçğıöşüÇĞİÖŞÜ'’-]+$/;

const VOWELS = new Set("aeıioöuüAEIİOÖUÜ".split(""));

/** Argo/küfür kökleri ve yaygın "doldurma" değerleri — tam kelime eşleşmesiyle kontrol edilir. */
const BLOCKED_WORDS = new Set(
  [
    // Argo / küfür (yaygın kökler)
    "amk",
    "aq",
    "oç",
    "oc",
    "piç",
    "pic",
    "orospu",
    "yavşak",
    "yavsak",
    "siktir",
    "sikik",
    "göt",
    "got",
    "ibne",
    "gavat",
    "şerefsiz",
    "serefsiz",
    "pezevenk",
    "kahpe",
    "yarrak",
    "puşt",
    "pust",
    "dangalak",
    "gerizekalı",
    "gerizekali",
    "salak",
    "aptal",
    // Yaygın doldurma / test değerleri (gerçek isim değil)
    "test",
    "deneme",
    "asdasd",
    "asdf",
    "qwerty",
    "yok",
    "bilinmiyor",
    "isim",
    "soyisim",
    "adsoyad",
    "xxx",
    "abc",
    "lorem",
    "ipsum",
    "none",
    "unknown",
    "anonim",
    "anonymous",
    "misafir",
    "guest",
  ].map(turkishLower),
);

/** `toLowerCase()` İ/I'yı yanlış çevirir (İ→i̇, I→i); Türkçe kurallara göre elle düzeltilir. */
function turkishLower(value: string): string {
  return value.replace(/İ/g, "i").replace(/I/g, "ı").toLowerCase();
}

function hasVowel(token: string): boolean {
  return [...token].some((char) => VOWELS.has(char));
}

/** Aynı harfin 3+ kez üst üste tekrarı ("aaaa", "xxxx") — gerçek isimde olmaz. */
function hasLongRepeat(token: string): boolean {
  return /(.)\1{2,}/.test(token);
}

export type NameCheckResult = { ok: true } | { ok: false; reason: string };

const INVALID_NAME_MESSAGE = "Geçerli bir ad soyad girin.";

/** Ad soyad girişinin makul bir insan ismi olup olmadığını kontrol eder. */
export function checkFullName(rawName: string): NameCheckResult {
  const name = rawName.trim().replace(/\s+/g, " ");
  const tokens = name.split(" ").filter(Boolean);

  if (tokens.length < 2) {
    return { ok: false, reason: "Ad ve soyadınızı birlikte girin (ör. “Ahmet Yılmaz”)." };
  }

  for (const token of tokens) {
    if (token.length < 2 || token.length > 30) return { ok: false, reason: INVALID_NAME_MESSAGE };
    if (!LETTERS_ONLY.test(token)) return { ok: false, reason: INVALID_NAME_MESSAGE };
    if (!hasVowel(token)) return { ok: false, reason: INVALID_NAME_MESSAGE };
    if (hasLongRepeat(token)) return { ok: false, reason: INVALID_NAME_MESSAGE };
    const normalized = turkishLower(token).replace(/['’-]/g, "");
    if (BLOCKED_WORDS.has(normalized)) {
      return { ok: false, reason: "Lütfen gerçek ad soyadınızı girin." };
    }
  }

  return { ok: true };
}
