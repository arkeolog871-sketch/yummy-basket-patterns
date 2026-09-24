import { createFileRoute } from "@tanstack/react-router";
import { LEGAL_CENTER_ORDER, LEGAL_DOCUMENTS, LEGAL_VERSIONS } from "@/lib/legal";

export const Route = createFileRoute("/yasal/")({
  head: () => ({
    meta: [
      { title: "Yasal Merkez — SİLVAN CEBİMDE" },
      { name: "description", content: "Sözleşmeler, KVKK, iptal-iade ve diğer yasal belgeler." },
      { property: "og:title", content: "Yasal Merkez — SİLVAN CEBİMDE" },
      { property: "og:description", content: "Tüm yasal belgeler tek yerde, sürüm bilgisiyle." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LegalCenter,
});

function LegalCenter() {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Yasal Merkez</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Platform aracı hizmet sağlayıcıdır; siparişlerdeki satıcı ilgili işletmedir. Tüm belgeler
        sürümlüdür.
      </p>
      <ul className="mt-8 divide-y divide-border rounded-3xl border border-border bg-card">
        {LEGAL_CENTER_ORDER.map((id) => {
          const doc = LEGAL_DOCUMENTS[id];
          return (
            <li key={id}>
              <a href={doc.path} className="block p-4 hover:bg-secondary/50">
                <span className="block font-semibold">{doc.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {doc.audience} · Sürüm {LEGAL_VERSIONS[id]} · {doc.description}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
