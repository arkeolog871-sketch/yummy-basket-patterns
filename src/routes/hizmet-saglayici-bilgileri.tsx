import { createFileRoute } from "@tanstack/react-router";
import { LegalDocumentPage } from "@/components/legal/LegalDocument";
import { LEGAL_DOCUMENTS } from "@/lib/legal";

const doc = LEGAL_DOCUMENTS.provider;

export const Route = createFileRoute("/hizmet-saglayici-bilgileri")({
  head: () => ({
    meta: [
      { title: `${doc.title} — SİLVAN CEBİMDE` },
      { name: "description", content: doc.description },
      { property: "og:title", content: `${doc.title} — SİLVAN CEBİMDE` },
      { property: "og:description", content: doc.description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <LegalDocumentPage docId="provider" />,
});
