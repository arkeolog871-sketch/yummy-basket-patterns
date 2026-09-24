import { createFileRoute, notFound } from "@tanstack/react-router";
import { LegalDocumentPage } from "@/components/legal/LegalDocument";
import { legalDocBySlug } from "@/lib/legal";

export const Route = createFileRoute("/yasal/$slug")({
  loader: ({ params }) => {
    const doc = legalDocBySlug(params.slug);
    if (!doc) throw notFound();
    return { id: doc.id, title: doc.title, description: doc.description };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.title ?? "Yasal"} — SİLVAN CEBİMDE` },
      { name: "description", content: loaderData?.description ?? "" },
      { property: "og:title", content: `${loaderData?.title ?? "Yasal"} — SİLVAN CEBİMDE` },
      { property: "og:description", content: loaderData?.description ?? "" },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  notFoundComponent: () => <p className="p-10 text-center">Belge bulunamadı.</p>,
  errorComponent: () => <p className="p-10 text-center">Belge yüklenemedi.</p>,
  component: () => {
    const { id } = Route.useLoaderData();
    return <LegalDocumentPage docId={id} />;
  },
});
