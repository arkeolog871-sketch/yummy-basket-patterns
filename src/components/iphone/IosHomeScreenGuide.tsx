import { useEffect, useState } from "react";
import { PlusSquare, Share2, X } from "lucide-react";

import { detectIosInstallKind, IOS_A2HS_FLAG } from "@/lib/iphone-install";

export function IosHomeScreenGuide() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (detectIosInstallKind() !== "safari") return;
    if (sessionStorage.getItem(IOS_A2HS_FLAG) !== "1") return;
    setOpen(true);
  }, []);

  if (!open) return null;

  function dismiss() {
    sessionStorage.removeItem(IOS_A2HS_FLAG);
    setOpen(false);
  }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col justify-end bg-black/55 p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Kapat"
        onClick={dismiss}
      />
      <div className="relative mx-auto w-full max-w-md rounded-[28px] bg-[#fff8f0] p-5 text-[#17120e] shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-3 top-3 rounded-full p-1.5 text-[#17120e]/60 hover:bg-black/5"
          aria-label="Kapat"
        >
          <X className="size-4" />
        </button>
        <p className="pr-8 text-lg font-semibold tracking-tight">iPhone’a kur</p>
        <p className="mt-1 text-sm leading-5 text-[#17120e]/70">
          iPhone dosya indirerek uygulama kurmaz. Safari’nin paylaş menüsünden ana ekrana ekleyin.
        </p>
        <ol className="mt-4 space-y-3 text-sm leading-5">
          <li className="flex gap-3">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-[#ff8c42] text-xs font-bold text-white">
              1
            </span>
            <span className="flex items-start gap-1.5">
              Alttaki <Share2 className="mt-0.5 size-4 shrink-0" /> Paylaş düğmesine dokunun.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-[#ff8c42] text-xs font-bold text-white">
              2
            </span>
            <span className="flex items-start gap-1.5">
              <PlusSquare className="mt-0.5 size-4 shrink-0" /> Ana Ekrana Ekle’yi seçin, ardından
              Ekle’ye dokunun.
            </span>
          </li>
        </ol>
        <p className="mt-4 text-center text-[11px] text-[#17120e]/50">
          Ana ekrandaki SİLVAN CEBİMDE simgesi uygulamayı tam ekran açar.
        </p>
        <div className="mt-3 flex justify-center" aria-hidden>
          <span className="h-1.5 w-24 rounded-full bg-[#17120e]/80" />
        </div>
      </div>
    </div>
  );
}
