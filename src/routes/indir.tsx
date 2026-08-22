import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, Smartphone } from "lucide-react";

import {
  ANDROID_APK_FILENAME,
  ANDROID_APK_HREF,
  detectDownloadPlatform,
  IPHONE_PROFILE_HREF,
  type DownloadPlatform,
} from "@/lib/app-downloads";

export const Route = createFileRoute("/indir")({
  head: () => ({
    meta: [
      { title: "SİLVAN CEBİMDE — Uygulamayı indir" },
      {
        name: "description",
        content:
          "SİLVAN CEBİMDE Android APK ve iPhone uygulamasını indirin. Yemek siparişini telefonunuzdan verin.",
      },
      { name: "theme-color", content: "#ff8c42" },
    ],
  }),
  component: IndirPage,
});

function IndirPage() {
  const [platform, setPlatform] = useState<DownloadPlatform>("other");

  useEffect(() => {
    setPlatform(detectDownloadPlatform(window.navigator.userAgent));
  }, []);

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.12em] text-primary">
        Android ve iPhone
      </p>
      <h1 className="font-display mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        Uygulamayı telefonunuza indirin
      </h1>
      <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
        SİLVAN CEBİMDE, sitenin tam halini telefonunuzda uygulama gibi açar. Play Store veya App
        Store gerekmez.
      </p>

      <div className="mt-8 grid w-full gap-4 sm:grid-cols-2">
        <DownloadCard
          title="Android APK"
          href={ANDROID_APK_HREF}
          download={ANDROID_APK_FILENAME}
          label="APK dosyasını indir"
          hint="silvan-cebimde.apk · ücretsiz"
          detail="İndirdikten sonra dosyaya dokunun. “Bilinmeyen kaynaklardan yüklemeye izin ver” uyarısı çıkarsa izin verin."
          highlighted={platform !== "ios"}
        />
        <DownloadCard
          title="iPhone uygulaması"
          href={IPHONE_PROFILE_HREF}
          label="iPhone uygulamasını kur"
          hint="silvan-cebimde-iphone.mobileconfig · ücretsiz"
          detail="iPhone APK yüklemez. Bu dosya uygulamayı ana ekrana ekler. Ayarlar → İndirilen Profil → Yükle."
          highlighted={platform === "ios"}
        />
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm">
        <Link
          to="/android"
          className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Android önizleme
        </Link>
        <Link
          to="/iphone"
          className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          iPhone önizleme
        </Link>
        <Link
          to="/mobil"
          className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Kurulum adımları
        </Link>
      </div>
      <Link
        to="/"
        className="mt-6 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        Siteye dön
      </Link>
    </div>
  );
}

function DownloadCard({
  title,
  href,
  download,
  label,
  hint,
  detail,
  highlighted,
}: {
  title: string;
  href: string;
  download?: string;
  label: string;
  hint: string;
  detail: string;
  highlighted: boolean;
}) {
  return (
    <div
      className={`rounded-3xl border bg-card p-5 text-left shadow-card ${
        highlighted ? "border-primary/50" : "border-border/70"
      }`}
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Smartphone className="size-4 text-primary" />
        {title}
      </p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p>
      <a
        href={href}
        {...(download ? { download } : {})}
        className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition-colors hover:bg-primary/90"
      >
        <Download className="mr-2 size-4" />
        {label}
      </a>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}
