import {
  LEGAL_DOCUMENTS,
  LEGAL_EFFECTIVE_LABEL,
  LEGAL_VERSIONS,
  type LegalDocId,
} from "@/lib/legal";

export function LegalDocumentBody({ docId }: { docId: LegalDocId }) {
  const doc = LEGAL_DOCUMENTS[docId];
  return (
    <div className="space-y-4 text-sm leading-6 text-muted-foreground">
      <p className="text-xs">
        Sürüm {LEGAL_VERSIONS[docId]} · {LEGAL_EFFECTIVE_LABEL} · {doc.updatedLabel} · İlgili taraf:{" "}
        {doc.audience}
      </p>
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <a href="/yasal" className="text-sm font-semibold uppercase tracking-[0.12em] text-primary">
          Yasal Merkez
        </a>
        <button
          type="button"
          onClick={() => window.print()}
          className="text-sm text-primary underline-offset-4 hover:underline print:hidden"
        >
          Yazdır / PDF olarak kaydet
        </button>
      </div>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">{doc.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{doc.description}</p>
      <div className="mt-8">
        <LegalDocumentBody docId={docId} />
      </div>
      <p className="mt-10 text-xs text-muted-foreground">
        İletişim ve platform kimliği için{" "}
        <a href="/hizmet-saglayici-bilgileri" className="underline underline-offset-4">
          Hizmet Sağlayıcı Bilgileri
        </a>
        .
      </p>
    </article>
  );
}
