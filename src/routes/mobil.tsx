import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Smartphone, Share2, PlusSquare, MoreVertical, Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const APK_VERSION = "1.3";
const APK_URL = `/silvan-cebimde.apk?v=${APK_VERSION}`;

export const Route = createFileRoute("/mobil")({
  head: () => ({
    meta: [
      { title: "Mobil Uygulama Kurulumu — SİLVAN CEBİMDE" },
      {
        name: "description",
        content:
          "SİLVAN CEBİMDE'yi Android ve iPhone'da ana ekranınıza ekleyip uygulama gibi kullanın. Kurulum adımları burada.",
      },
      { property: "og:title", content: "Mobil Uygulama Kurulumu — SİLVAN CEBİMDE" },
      {
        property: "og:description",
        content: "Android ve iPhone'da ana ekrana ekleyerek uygulama deneyimi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MobilePage,
});

type InstallPromptEvent = Event & { prompt: () => Promise<void> };

function MobilePage() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if (window.matchMedia("(display-mode: standalone)").matches) setInstalled(true);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Smartphone className="size-6" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Telefonuna kur
          </h1>
          <p className="text-sm text-muted-foreground">
            SİLVAN CEBİMDE'yi ana ekranına ekle, tam ekran uygulama gibi kullan.
          </p>
        </div>
      </div>

      <Card className="mt-6 border-primary/30">
        <CardHeader>
          <CardTitle className="text-base">Android APK indir</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Telefonuna gerçek uygulama dosyasını kur. Play Store gerekmez. Güncel sürüm: {APK_VERSION}.
          </p>
          <Button className="w-full" asChild>
            <a href={APK_URL} download="silvan-cebimde.apk">
              <Download className="mr-2 size-4" />
              APK dosyasını indir
            </a>
          </Button>
          <p className="text-xs text-muted-foreground">
            Bu dosya otomatik güncellenmez; yeni sürümü indirip mevcut uygulamanın üzerine kurman gerekir.
          </p>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Tarayıcıdan ana ekrana ekle</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {installed ? (
            <p className="text-sm text-muted-foreground">
              Uygulama zaten kurulu görünüyor. Ana ekranındaki simgeden açabilirsin.
            </p>
          ) : (
            <>
              <Button
                className="w-full"
                disabled={!promptEvent}
                onClick={() => {
                  void promptEvent?.prompt();
                }}
              >
                <Download className="mr-2 size-4" />
                {promptEvent ? "Uygulamayı kur" : "Kurulum menüden yapılır"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Buton pasifse tarayıcı menüsünden aşağıdaki adımları izle.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Android (Chrome)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p className="flex items-start gap-2">
              <MoreVertical className="mt-0.5 size-4 shrink-0" />
              Sağ üstteki üç noktaya dokun.
            </p>
            <p className="flex items-start gap-2">
              <PlusSquare className="mt-0.5 size-4 shrink-0" />
              “Uygulamayı yükle” ya da “Ana ekrana ekle” seçeneğini seç.
            </p>
            <p>Onayla; simge ana ekranına eklenir ve tam ekran açılır.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">iPhone (Safari)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p className="flex items-start gap-2">
              <Share2 className="mt-0.5 size-4 shrink-0" />
              Alt çubuktaki paylaş simgesine dokun.
            </p>
            <p className="flex items-start gap-2">
              <PlusSquare className="mt-0.5 size-4 shrink-0" />
              “Ana Ekrana Ekle” seçeneğini seç ve “Ekle”ye dokun.
            </p>
            <p>Uygulama simgesi ana ekranında görünür.</p>
          </CardContent>
        </Card>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Not: Kurulum canlı (yayınlanmış) adres üzerinde çalışır; düzenleyici önizlemesinde
        tarayıcı kurulum menüsü görünmeyebilir.
      </p>
    </main>
  );
}
