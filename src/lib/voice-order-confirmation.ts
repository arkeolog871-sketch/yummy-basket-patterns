/**
 * Sesli siparişte onay cümlesini ve onay cevabını çözer.
 *
 * NEDEN AYRI VE KATI: bu modülün "evet" demesi gerçek bir sipariş oluşturur —
 * işletme hazırlığa başlar, kurye yola çıkar. Yapay zekânın niyet tahminine
 * bırakılamaz; kararı burada, okunabilir ve test edilebilir bir kural verir.
 *
 * KURAL: onay yalnızca KISA ve NET bir cevaptan çıkar. "Evet ama bir de ayran
 * ekle" onay değildir — kullanıcı siparişi değiştiriyor. Şüphe varsa sonuç
 * "belirsiz"dir ve sohbet devam eder; sipariş oluşmaz.
 */
import type { CartProposal } from "./ai-assistant.types";

export type VoiceConfirmation = "evet" | "hayir" | "belirsiz";

/** Tek başına "onay" sayılan sözcükler. */
const ONAY = [
  "evet",
  "tamam",
  "tamamdır",
  "olur",
  "onaylıyorum",
  "onayla",
  "onay",
  "kabul",
  "peki",
  "oldu",
  "gönder",
  "ver",
  "doğru",
  "he",
  "hı",
  "hihi",
];

/** Onayı geçersiz kılan sözcükler; biri geçiyorsa onay yok. */
const RET = [
  "hayır",
  "hayir",
  "yok",
  "olmaz",
  "iptal",
  "vazgeç",
  "vazgectim",
  "vazgeçtim",
  "istemiyorum",
  "dur",
  "bekle",
  "boşver",
  "bosver",
  "yanlış",
  "yanlis",
];

/** Sipariş değişikliği isteyen sözcükler: onay değil, yeni istek. */
const DEGISIKLIK = ["ekle", "çıkar", "cikar", "değiştir", "degistir", "yerine", "ama", "fakat"];

function normalize(text: string): string[] {
  return text
    .toLocaleLowerCase("tr")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function parseVoiceConfirmation(text: string): VoiceConfirmation {
  const words = normalize(text);
  if (words.length === 0) return "belirsiz";
  if (words.some((word) => RET.includes(word))) return "hayir";
  // Uzun cümle onay değil: kullanıcı büyük ihtimalle yeni bir şey söylüyor.
  if (words.length > 4) return "belirsiz";
  if (words.some((word) => DEGISIKLIK.includes(word))) return "belirsiz";
  if (words.some((word) => ONAY.includes(word))) return "evet";
  return "belirsiz";
}

export interface ConfirmationAddress {
  recipient_name: string;
  district: string;
  city: string;
}

/**
 * Onay için okunacak cümle. Sesli okunacağı için kısa ve sayıları
 * anlaşılır tutuyor; liste yerine "N kalem" diyor ki uzun sepette cümle
 * dakikalarca sürmesin.
 */
export function buildOrderConfirmationSpeech(
  proposal: CartProposal,
  address: ConfirmationAddress,
): string {
  const adet = proposal.lines.reduce((sum, line) => sum + line.quantity, 0);
  const total = proposal.subtotal + (proposal.restaurant.deliveryFee || 0);
  const kalemler = proposal.lines
    .slice(0, 3)
    .map((line) => (line.quantity > 1 ? `${line.quantity} ${line.name}` : line.name))
    .join(", ");
  const devami = proposal.lines.length > 3 ? " ve diğerleri" : "";
  const teslimat =
    proposal.restaurant.deliveryFee > 0
      ? ` Teslimat ücreti ${formatLira(proposal.restaurant.deliveryFee)}.`
      : "";
  return (
    `${proposal.restaurant.name} işletmesinden ${kalemler}${devami}; toplam ${adet} ürün, ` +
    `${formatLira(total)}.${teslimat} ` +
    `${address.recipient_name} adına ${address.district} ${address.city} adresine, kapıda ödeme. ` +
    "Siparişi onaylıyor musunuz?"
  );
}

/** Sesli okunacağı için kuruşu yalnızca gerektiğinde söylüyoruz. */
function formatLira(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? `${rounded} lira` : `${rounded.toFixed(2)} lira`;
}
