import { createFileRoute } from "@tanstack/react-router";
import { LegalDocumentPage } from "@/components/legal/LegalDocument";
import { LEGAL_DOCUMENTS } from "@/lib/legal";

const doc = LEGAL_DOCUMENTS.privacy;

export const Route = createFileRoute("/gizlilik-politikasi")({
  head: () => ({
    meta: [
      { title: `${doc.title} — SİLVAN CEBİMDE` },
      { name: "description", content: doc.description },
    ],
  }),
  component: () => <LegalDocumentPage docId="privacy" />,
});
