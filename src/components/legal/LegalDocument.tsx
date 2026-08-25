import { LEGAL_DOCUMENTS, type LegalDocId } from "@/lib/legal";

export function LegalDocumentBody({ docId }: { docId: LegalDocId }) {
  const doc = LEGAL_DOCUMENTS[docId];
  return (
    <div className="space-y-4 text-sm leading-6 text-muted-foreground">
      <p className="text-xs">{doc.updatedLabel}</p>
      {doc.paragraphs.map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </div>
  );
}

export function LegalDocumentPage({ docId }: { docId: LegalDocId }) {
  const doc = LEGAL_DOCUMENTS[docId];
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-16">
      <p className="text-sm font-semibold uppercase tracking-[0.12em] text-primary">Yasal</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">{doc.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{doc.description}</p>
      <div className="mt-8">
        <LegalDocumentBody docId={docId} />
      </div>
    </article>
  );
}
