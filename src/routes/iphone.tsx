import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Copy, PlusSquare, Share2, Smartphone } from "lucide-react";

import {
  detectIosInstallKind,
  IOS_A2HS_FLAG,
  safariInstallUrl,
  type IosInstallKind,
} from "@/lib/iphone-install";

export const Route = createFileRoute("/iphone")({
  head: () => ({
    meta: [
      { title: "SİLVAN CEBİMDE — iPhone’a kur" },
      {
        name: "description",
        content:
          "SİLVAN CEBİMDE’yi iPhone Safari’den ana ekrana ekleyin. App Store gerekmez; indirme dosyası yoktur.",
      },
      { name: "theme-color", content: "#141416" },
    ],
  }),
  component: IphonePage,
});

function IphonePage() {
  const [kind, setKind] = useState<IosInstallKind>("unknown");
  const [copied, setCopied] = useState(false);
  const installUrl = safariInstallUrl();

  useEffect(() => {
    const next = detectIosInstallKind();
    setKind(next);
    if (next === "safari") {
      sessionStorage.setItem(IOS_A2HS_FLAG, "1");
      window.location.replace("/");
    }
  }, []);

  async function copySafariLink() {
    try {
      await navigator.clipboard.writeText(installUrl);
      setCopied(true);
    } catch {
      window.prompt("Bu adresi Safari’ye yapıştırın", installUrl);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#141416] px-4 py-10">
      <div className="w-full max-w-md text-center text-[#f4ece4]">
        <span className="mx-auto flex size-14 items-center justify-center rounded-[22px] bg-[#ff8c42] text-white shadow-[0_12px_40px_rgba(255,140,66,0.35)]">
          <Smartphone className="size-7" />
        </span>
        <p className="mt-5 text-[13px] font-semibold uppercase tracking-[0.12em] text-[#ff8c42]">
          iPhone
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Ana ekrana ekle</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#cbb8a8]">
          iPhone APK veya profil dosyası yüklemez. Uygulama, Safari’den ana ekrana eklenerek
          kurulur.
        </p>

        {kind === "unknown" || kind === "safari" ? (
          <p className="mt-8 text-sm text-[#cbb8a8]">Safari kurulum adımları açılıyor…</p>
        ) : null}

        {kind === "installed" ? (
          <p className="mt-8 rounded-2xl border border-[#30d158]/40 bg-[#30d158]/10 px-4 py-3 text-sm text-[#7dffa1]">
            Uygulama zaten kurulu. Ana ekrandaki simgeden açabilirsiniz.
          </p>
        ) : null}

        {kind === "ios-other" ? (
          <div className="mt-8 space-y-4">
            <p className="text-sm leading-6 text-[#cbb8a8]">
              Ana ekrana ekleme yalnızca Safari’de çalışır. Bu tarayıcı veya uygulama içi pencereden
              kurulamaz.
            </p>
            <button
              type="button"
              onClick={() => void copySafariLink()}
              className="inline-flex w-full items-center justify-center rounded-full bg-[#ff8c42] px-5 py-3 text-sm font-semibold text-white"
            >
              {copied ? <Check className="mr-2 size-4" /> : <Copy className="mr-2 size-4" />}
              {copied ? "Kopyalandı — Safari’de açın" : "Safari bağlantısını kopyala"}
            </button>
            <p className="text-[12px] leading-5 text-[#cbb8a8]">
              Safari’yi açıp yapıştırın. Paylaş → Ana Ekrana Ekle adımları orada çıkar.
            </p>
          </div>
        ) : null}

        {kind === "android" ? (
          <p className="mt-8 text-sm leading-6 text-[#cbb8a8]">
            Bu sayfa iPhone içindir. Android için{" "}
            <a
              href="/indir"
              className="font-semibold text-[#ff8c42] underline-offset-4 hover:underline"
            >
              APK indirme sayfasını
            </a>{" "}
            kullanın.
          </p>
        ) : null}

        {kind === "desktop" ? (
          <div className="mt-8 space-y-3">
            <p className="text-sm leading-6 text-[#cbb8a8]">
              iPhone’unuzda Safari ile bu adresi açın:
            </p>
            <button
              type="button"
              onClick={() => void copySafariLink()}
              className="inline-flex w-full items-center justify-center rounded-full bg-[#ff8c42] px-5 py-3 text-sm font-semibold text-white"
            >
              {copied ? <Check className="mr-2 size-4" /> : <Copy className="mr-2 size-4" />}
              {copied ? "Kopyalandı" : "iPhone bağlantısını kopyala"}
            </button>
            <p className="break-all text-[12px] text-[#cbb8a8]">{installUrl}</p>
          </div>
        ) : null}

        <ol className="mt-10 space-y-3 text-left text-sm leading-6 text-[#cbb8a8]">
          <li className="flex gap-3">
            <Share2 className="mt-0.5 size-4 shrink-0 text-[#ff8c42]" />
            Safari alt çubuğundaki Paylaş simgesine dokunun.
          </li>
          <li className="flex gap-3">
            <PlusSquare className="mt-0.5 size-4 shrink-0 text-[#ff8c42]" />
            Ana Ekrana Ekle’yi seçin ve Ekle’ye dokunun.
          </li>
        </ol>
      </div>
    </div>
  );
}
