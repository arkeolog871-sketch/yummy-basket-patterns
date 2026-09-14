/**
 * Formlardaki sayı alanlarını okur.
 *
 * Türkçe klavyede ondalık ayırıcı virgüldür: kullanıcı enlemi "38,1502",
 * teslimat ücretini "10,50" diye yazıyor. `Number()` bunları NaN yapıyor ve
 * sunucu doğrulaması "Expected number, received nan" diye İngilizce, hangi
 * alandan bahsettiğini söylemeyen bir hata döndürüyordu; başvuru sahibi neyi
 * düzelteceğini anlayamıyordu. Kurucu panelinde ise aynı değer sessizce
 * atılıyor, işletme konumsuz kaydediliyordu.
 *
 * İçinde nokta varsa metne dokunulmaz: "38.1502" zaten geçerli, "38.15, 40.99"
 * gibi yapıştırılmış bir çift ise null döner ve çağıran taraf kullanıcıya ne
 * yazması gerektiğini söyler — sessizce ilk sayıyı almak yanlış konuma yol
 * açardı.
 */
export function parseDecimalInput(value: string): number | null {
  const text = value.trim();
  if (!text) return null;
  const normalized = text.includes(".") ? text : text.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
