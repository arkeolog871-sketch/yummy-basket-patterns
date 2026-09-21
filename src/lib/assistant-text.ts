/**
 * Asistan yanıtını mobil uygulamada okunur hale getirir.
 *
 * Mobil uygulamada sohbet balonları düz metin gösteriyor; model yıldızlı
 * (**kalın**) veya başlıklı markdown yazdığında bu işaretler kullanıcıya
 * olduğu gibi görünüyor ve sesli okumada da "yıldız yıldız" gibi tuhaf
 * sonuçlar doğuruyor. Bu yüzden biçimlendirme işaretleri temizlenir; metnin
 * kendisi ve satır düzeni korunur.
 */
export function stripMarkdownForPlainText(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```[a-zA-Z]*\n?/g, "").trim())
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, "$2")
    .replace(/(^|[\s(])[*_](?=\S)([^*_\n]*\S)[*_](?=[\s.,;:!?)]|$)/g, "$1$2")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s{0,3}[*+]\s+/gm, "- ")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
