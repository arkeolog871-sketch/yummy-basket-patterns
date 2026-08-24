import { createFileRoute, Link, notFound } from "@tanstack/react-router";

export const Route = createFileRoute("/$")({
  beforeLoad: () => {
    throw notFound();
  },
  head: () => ({
    meta: [
      { title: "Sayfa bulunamadı — SİLVAN CEBİMDE" },
      { name: "robots", content: "noindex" },
      {
        name: "description",
        content: "Aradığınız sayfa yok veya taşınmış olabilir.",
      },
    ],
  }),
  notFoundComponent: CatchAllNotFound,
  component: CatchAllNotFound,
});

function CatchAllNotFound() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Sayfa bulunamadı</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Aradığınız sayfa yok veya taşınmış olabilir.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ana sayfaya dön
          </Link>
        </div>
      </div>
    </div>
  );
}
