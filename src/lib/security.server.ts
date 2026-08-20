import { createHash, randomBytes } from "crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Kullanıcıya bağlı, geri döndürülemez kod özeti üretir. */
export function hashBackupCode(userId: string, code: string): string {
  return createHash("sha256")
    .update(`${userId}:${code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")}`)
    .digest("hex");
}

export function generateBackupCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const bytes = randomBytes(8);
    const raw = Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
  });
}
