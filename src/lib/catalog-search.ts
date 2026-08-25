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
