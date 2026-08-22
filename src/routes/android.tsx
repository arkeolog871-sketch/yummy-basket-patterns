import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/android")({
  head: () => ({
    meta: [
      { title: "SİLVAN CEBİMDE — Android uygulama önizlemesi" },
      {
        name: "description",
        content: "SİLVAN CEBİMDE tasarımını Android telefon uygulaması olarak önizleyin.",
      },
      { name: "robots", content: "noindex" },
      { name: "theme-color", content: "#141416" },
    ],
  }),
  component: AndroidPreview,
});

function AndroidPreview() {
  const [clock, setClock] = useState("12:00");

  useEffect(() => {
    const tick = () =>
      setClock(
        new Intl.DateTimeFormat("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }).format(new Date()),
      );
    tick();
    const timer = window.setInterval(tick, 15000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#141416] px-4 py-8">
      <div className="w-full max-w-[393px]">
        <div className="mb-4 text-center text-[#f4ece4]">
          <p className="text-[15px] font-semibold uppercase tracking-[0.08em]">SİLVAN CEBİMDE</p>
          <p className="mt-1.5 text-[13px] text-[#cbb8a8]">Android mobil uygulama önizlemesi</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <a
              href="/silvan-cebimde.apk"
              download="silvan-cebimde.apk"
              className="inline-flex rounded-full bg-[#ff8c42] px-4 py-2 text-[13px] font-semibold text-white"
            >
              APK indir
            </a>
            <a
              href="/iphone"
              className="inline-flex rounded-full border border-[#cbb8a8]/40 px-4 py-2 text-[13px] font-semibold text-[#f4ece4]"
            >
              iPhone sürümü
            </a>
          </div>
        </div>
        <div
          className="h-[852px] max-h-[calc(100svh-6rem)] rounded-[48px] bg-gradient-to-br from-[#2a2a2e] to-[#070708] p-2.5 shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
          style={{ boxShadow: "0 0 0 2px #3a3a40, 0 24px 80px rgba(0,0,0,0.55)" }}
        >
          <div className="relative flex h-full flex-col overflow-hidden rounded-[38px] bg-[#fff8f0]">
            <span className="absolute left-1/2 top-2.5 z-10 size-[18px] -translate-x-1/2 rounded-full bg-[#050506] shadow-[inset_0_0_0_2px_#1c1c20]" />
            <div className="relative z-[2] flex h-9 items-center justify-between bg-gradient-to-b from-[#17120e] to-transparent px-5 pt-2 text-[12px] font-semibold text-[#f6f1ea]">
              <span className="tabular-nums">{clock}</span>
              <span className="flex items-center gap-1.5 opacity-90" aria-hidden>
                <span className="h-2.5 w-3.5 rounded-[1px] bg-current" />
                <span className="h-2.5 w-3 rounded-b-full border-2 border-t-0 border-current" />
                <span className="relative h-2.5 w-5 rounded-[2px] border border-current">
                  <span className="absolute inset-0.5 w-[70%] rounded-[1px] bg-[#7dffa1]" />
                </span>
              </span>
            </div>
            <iframe
              title="SİLVAN CEBİMDE"
              src="/"
              className="min-h-0 w-full flex-1 border-0 bg-[#fff8f0]"
              allow="geolocation; clipboard-read; clipboard-write"
            />
            <div className="grid h-[18px] place-items-center bg-[#17120e]">
              <span className="h-1 w-[108px] rounded-full bg-[#d9d0c6]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
