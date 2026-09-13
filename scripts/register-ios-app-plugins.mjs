/**
 * Uygulama hedefinde tanımlı Capacitor eklentilerini kayıt listesine ekler.
 *
 * Capacitor iOS'ta eklenti taraması yoktur: CapacitorBridge.registerPlugins()
 * yalnızca uygulama paketindeki capacitor.config.json içindeki
 * packageClassList'i okur (ObjC çalışma zamanı taraması yapmaz), ve
 * registerPluginType() autoRegisterPlugins açıkken hiçbir şey yapmaz. O listeyi
 * ise `cap sync` yalnızca npm eklenti PAKETLERİNDEN üretir ve her seferinde
 * baştan yazar. Dolayısıyla ios/App/App altında duran bir eklenti sınıfı
 * derlenir, uygulamaya girer, ama asla kaydolmaz — web tarafı köprüyü hiç
 * göremez ve sessizce yedek akışa düşer.
 *
 * Bu betik `cap sync ios`'tan SONRA çalışmalıdır.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const APP_DIR = join(ROOT, "ios/App/App");
const CONFIG = join(APP_DIR, "capacitor.config.json");

/** Capacitor CLI'nin paketler için kullandığı desenin aynısı. */
export function appTargetPluginClasses() {
  return readdirSync(APP_DIR)
    .filter((name) => name.endsWith(".swift"))
    .flatMap((name) => {
      const source = readFileSync(join(APP_DIR, name), "utf8");
      // Yalnızca gerçek eklentiler: CAPPlugin türevi + ObjC'ye açılmış ad.
      if (!/:\s*CAPPlugin\b/.test(source)) return [];
      const match = /@objc\(([A-Za-z0-9_]+)\)/.exec(source);
      return match ? [match[1]] : [];
    });
}

function main() {
  if (!existsSync(CONFIG)) {
    console.error(`BLOCKED: ${CONFIG} yok. Önce \`npx cap sync ios\` çalıştırın.`);
    process.exit(1);
  }

  const found = appTargetPluginClasses();
  if (found.length === 0) {
    console.error("BLOCKED: ios/App/App altında @objc işaretli bir CAPPlugin sınıfı bulunamadı.");
    process.exit(1);
  }

  const config = JSON.parse(readFileSync(CONFIG, "utf8"));
  const before = Array.isArray(config.packageClassList) ? config.packageClassList : [];
  const added = found.filter((name) => !before.includes(name));
  config.packageClassList = [...before, ...added];
  writeFileSync(CONFIG, `${JSON.stringify(config, null, "\t")}\n`);

  console.log(`packageClassList: ${config.packageClassList.join(", ")}`);
  console.log(added.length ? `eklendi: ${added.join(", ")}` : "eklenecek yeni sınıf yok");
}

// Testler sadece appTargetPluginClasses'ı içe aktarır; yazma yalnızca
// betik doğrudan çalıştırıldığında olur.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main();
}
