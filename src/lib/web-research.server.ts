/**
 * İnternet araştırması — yalnızca sunucu tarafı.
 *
 * Asistan kültür, turizm, günlük hayat, resmî duyuru gibi genel konularda
 * internete bakabilir. ÖNEMLİ: İŞLETME bilgisi internetten gelmez. Bu yüzden
 * rehber/pazaryeri/harita siteleri sonuçlardan mekanik olarak ayıklanır ve
 * asistanın sistem talimatı da bunu ayrıca yasaklar.
 */

/** İşletme/firma listeleyen kaynaklar — asistan buradan veri almasın. */
const BLOCKED_HOST_FRAGMENTS = [
  "yemeksepeti",
  "getir",
  "trendyol",
  "hepsiburada",
  "migros",
  "n11",
  "sahibinden",
  "yelp",
  "foursquare",
  "tripadvisor",
  "zomato",
  "google.com/maps",
  "maps.google",
  "bulurum",
  "firmarehberi",
  "rehber",
  "yandex.com/maps",
  "neredekal",
  "eniyi",
  "sikayetvar",
];

const MAX_PAGE_CHARS = 6000;

function isBlocked(url: string): boolean {
  const lower = url.toLowerCase();
  return BLOCKED_HOST_FRAGMENTS.some((fragment) => lower.includes(fragment));
}

function decodeEntities(value: string): string {
  return value
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_all, code: string) => String.fromCharCode(Number(code)));
}

function stripTags(value: string): string {
  return decodeEntities(value.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function unwrapDuckDuckGoLink(href: string): string | null {
  try {
    const absolute = href.startsWith("//") ? `https:${href}` : href;
    const url = new URL(absolute);
    const target = url.searchParams.get("uddg");
    const finalUrl = target ? decodeURIComponent(target) : absolute;
    const parsed = new URL(finalUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export type WebResult = { title: string; url: string; snippet: string };

/** Serbest internet araması (DuckDuckGo). İşletme rehberleri filtrelenir. */
export async function searchWeb(query: string): Promise<WebResult[]> {
  const term = query.trim().slice(0, 200);
  if (!term) return [];

  const response = await fetch(
    `https://html.duckduckgo.com/html/?kl=tr-tr&q=${encodeURIComponent(term)}`,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Mobile Safari/537.36",
        "Accept-Language": "tr,en;q=0.8",
      },
    },
  );
  if (!response.ok) return [];
  const html = await response.text();

  const results: WebResult[] = [];
  const blockRegex = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>([\s\S]{0,1200}?)(?=<a[^>]+class="[^"]*result__a|$)/g;
  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(html)) !== null && results.length < 6) {
    const url = unwrapDuckDuckGoLink(match[1] ?? "");
    if (!url || isBlocked(url)) continue;
    const title = stripTags(match[2] ?? "");
    const snippetMatch = /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/.exec(match[3] ?? "");
    const snippet = stripTags(snippetMatch?.[1] ?? "").slice(0, 400);
    if (!title) continue;
    results.push({ title, url, snippet });
  }
  return results;
}

/** Bir web sayfasının okunabilir metnini döndürür (kısaltılmış). */
export async function readWebPage(url: string): Promise<{ url: string; text: string } | { error: string }> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { error: "Geçersiz adres." };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { error: "Yalnızca web adresleri okunabilir." };
  }
  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    /^\d+\.\d+\.\d+\.\d+$/.test(host) ||
    host.includes("supabase") ||
    host.includes("lovable")
  ) {
    return { error: "Bu adres okunamıyor." };
  }
  if (isBlocked(parsed.toString())) {
    return { error: "Bu kaynak işletme rehberi olduğu için kullanılamaz." };
  }

  const response = await fetch(parsed.toString(), {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Mobile Safari/537.36",
      "Accept-Language": "tr,en;q=0.8",
    },
  });
  if (!response.ok) return { error: `Sayfa açılamadı (${response.status}).` };
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
    return { error: "Bu içerik okunabilir metin değil." };
  }
  const html = (await response.text()).slice(0, 400_000);
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ");
  const text = stripTags(body).slice(0, MAX_PAGE_CHARS);
  if (!text) return { error: "Sayfada metin bulunamadı." };
  return { url: parsed.toString(), text };
}
