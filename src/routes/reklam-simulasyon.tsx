import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AdSimulationStudio } from "@/components/home/AdSimulationStudio";

export const Route = createFileRoute("/reklam-simulasyon")({
  head: () => ({
    meta: [
      { title: "Reklam simülasyonu — SİLVAN CEBİMDE" },
      {
        name: "description",
        content: "Reklam yükleme (görsel/video) ve ana sayfa kayan panosu görüntüleme simülasyonu.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdSimulationPage,
});

function AdSimulationPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <Link
        to="/"
        search={{ sim: "reklam" }}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Ana sayfada görüntüle
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Reklam yükleme ve görüntüleme</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Bu sayfa yayın değildir. Şema SQL’si veya kurucu girişi olmadan yükleme sniff’ini ve kayan panoyu
        deneyebilirsiniz. Gerçek kayıt için Kurucu → Reklamlar.
      </p>
      <div className="mt-8">
        <AdSimulationStudio />
      </div>
    </main>
  );
}
