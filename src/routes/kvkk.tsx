import { createFileRoute } from "@tanstack/react-router";
import { LegalDocumentPage } from "@/components/legal/LegalDocument";
import { LEGAL_DOCUMENTS } from "@/lib/legal";

const doc = LEGAL_DOCUMENTS.kvkk;

export const Route = createFileRoute("/kvkk")({
  head: () => ({
    meta: [
      { title: `${doc.title} — SİLVAN CEBİMDE` },
      { name: "description", content: doc.description },
    ],
  }),
  component: () => <LegalDocumentPage docId="kvkk" />,
});
