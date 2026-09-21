import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SERVER = join(process.cwd(), "src/lib/ai-menu-import.server.ts");
const FUNCTIONS = join(process.cwd(), "src/lib/ai-menu-import.functions.ts");
const COMPONENT = join(process.cwd(), "src/components/products/PhotoMenuImport.tsx");

describe("fotoğraftan ürün çıkarma — güvenlik sözleşmesi", () => {
  it("iki sunucu fonksiyonu da yetki kontrolünden geçer", () => {
    const source = readFileSync(FUNCTIONS, "utf8");
    for (const fn of ["extractMenuItemsFromPhoto", "importExtractedMenuItems"]) {
      expect(source).toContain(`export const ${fn} = createServerFn`);
 expect(source).toContain(".middleware([requireSupabaseAuth])");
    }
    // Her handler assertImportAccess'i çağırır: işletme kendi kataloğunu,
    // kurucu/bölge yöneticisi yalnızca yetki alanındaki işletmeyi işleyebilir.
    const calls = source.match(/await assertImportAccess\(/g) ?? [];
    expect(calls.length).toBe(2);
  });

  it("kayıt service_role RPC üzerinden olur, istemci yetkisiyle doğrudan yazmaz", () => {
    const source = readFileSync(FUNCTIONS, "utf8");
    expect(source).toMatch(/import\("@\/integrations\/supabase\/client\.server"\)/);
    expect(source).toMatch(/rpc\("import_menu_items_by_name"/);
  });

  it("aktarım günlüğü ai_menu_photo kaynağıyla yazılır", () => {
    const source = readFileSync(FUNCTIONS, "utf8");
    expect(source).toMatch(/source:\s*"ai_menu_photo"/);
    expect(source).toMatch(/from\("product_imports"\)/);
  });

  it("fotoğraf sınırı 4 ve sunucu şemasıyla aynı", () => {
    const server = readFileSync(SERVER, "utf8");
    const functions = readFileSync(FUNCTIONS, "utf8");
    expect(server).toMatch(/export const MAX_PHOTOS = 4/);
    expect(functions).toMatch(/\.max\(MAX_PHOTOS\)/);
  });

  it("çıkarma akışlı yapılır (buffered çağrı yok) ve reasoning ayarları tamam", () => {
    const server = readFileSync(SERVER, "utf8");
    expect(server).toMatch(/streamText\(/);
    expect(server).not.toMatch(/generateText|generateObject/);
    expect(server).toMatch(/forceReasoning:\s*true/);
    expect(server).toMatch(/store:\s*false/);
    expect(server).toMatch(/include:\s*\["reasoning\.encrypted_content"\]/);
    // Model kimliği katalogdaki gibi prefix'li yazılır.
    expect(server).toMatch(/lovable\.responses\("openai\/gpt-6-astra"\)/);
    // Anahtar asla modül kapsamında okunmaz, handler içinde okunur.
    expect(server).toMatch(/process\.env\["LOVABLE_API_KEY"\]/);
  });

  it("sonuç asla doğrudan veritabanına yazılmaz — bileşen onay akışı kullanır", () => {
    const component = readFileSync(COMPONENT, "utf8");
    expect(component).toMatch(/useServerFn\(extractMenuItemsFromPhoto\)/);
    expect(component).toMatch(/useServerFn\(importExtractedMenuItems\)/);
    // Bileşen supabase istemcisini hiç çağırmaz.
    expect(component).not.toMatch(/supabase/i);
  });
});
