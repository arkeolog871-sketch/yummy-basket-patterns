import { createFileRoute } from "@tanstack/react-router";
import { LegalDocumentPage } from "@/components/legal/LegalDocument";
import { LEGAL_DOCUMENTS } from "@/lib/legal";

const doc = LEGAL_DOCUMENTS.terms;

export const Route = createFileRoute("/kullanim-kosullari")({
  head: () => ({
    meta: [
      { title: `${doc.title} — SİLVAN CEBİMDE` },
      { name: "description", content: doc.description },
    ],
  }),
  component: () => <LegalDocumentPage docId="terms" />,
});
