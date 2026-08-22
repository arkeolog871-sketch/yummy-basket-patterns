import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/indir")({
  head: () => ({
    meta: [
      { title: "SİLVAN CEBİMDE — Android uygulamasını indir" },
      {
        name: "description",
        content: "SİLVAN CEBİMDE Android uygulamasını indirin. Yemek siparişini telefonunuzdan verin.",
      },
      { name: "theme-color", content: "#ff8c42" },
    ],
  }),
  component: IndirPage,
});

function IndirPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.12em] text-primary">Android</p>
      <h1 className="font-display mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        Uygulamayı telefonunuza indirin
      </h1>
      <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
        SİLVAN CEBİMDE Android uygulaması, sitenin tam halini telefonunuzda açar. Play Store
        dışından yüklendiği için indirdikten sonra “Bilinmeyen kaynaklardan yüklemeye izin ver”
        seçeneğini açmanız gerekir.
      </p>
      <a
        href="/silvan-cebimde.apk"
        download="silvan-cebimde.apk"
        className="mt-8 inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition-colors hover:bg-primary/90"
      >
        APK dosyasını indir
      </a>
      <p className="mt-3 text-xs text-muted-foreground">silvan-cebimde.apk · ücretsiz</p>
      <Link to="/" className="mt-10 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
        Siteye dön
      </Link>
    </div>
  );
}
