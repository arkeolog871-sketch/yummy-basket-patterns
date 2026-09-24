import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPlatformIdentity } from "@/lib/compliance.functions";
import {
  fillLegalText,
  LEGAL_DOCUMENTS,
  LEGAL_EFFECTIVE_LABEL,
  LEGAL_PACKAGE_LABEL,
  LEGAL_VERSIONS,
  missingTokensForDoc,
  type LegalDocId,
} from "@/lib/legal";

export function usePlatformIdentity() {
  const fetchIdentity = useServerFn(getPlatformIdentity);
  return useQuery({
    queryKey: ["platform-identity"],
    queryFn: () => fetchIdentity(),
    staleTime: 5 * 60_000,
  });
}

export function LegalDocumentBody({ docId }: { docId: LegalDocId }) {
  const doc = LEGAL_DOCUMENTS[docId];
  const { data, isLoading } = usePlatformIdentity();
  const identity = (data?.identity ?? {}) as Record<string, string | null>;
  const missing = data ? missingTokensForDoc(docId, identity) : [];
  return (
    <div className="space-y-4 text-sm leading-6 text-muted-foreground">
      <p className="text-xs">
        {LEGAL_PACKAGE_LABEL} · Sürüm {LEGAL_VERSIONS[docId]}.0 · {LEGAL_EFFECTIVE_LABEL} ·{" "}
        {doc.updatedLabel} · Hedef kitle: {doc.audience}
      </p>
      {!isLoading && missing.length ? (
        <div role="note" className="rounded-xl border border-border bg-muted/50 p-3 text-foreground">
          <p className="font-semibold">Bu belge yayına hazır değil</p>
          <p className="mt-1 text-muted-foreground">
            Nedeni: platform kimlik bilgilerinin bir kısmı ({missing.length} alan) yönetici
            tarafından henüz girilmedi. Bu alanlar metinde “Eksik — yönetici tarafından
            tamamlanmalı” olarak gösterilir. Belgeyi okuyabilir, yazdırabilir ve uygulamayı
            kullanmaya devam edebilirsiniz.
          </p>
        </div>
      ) : null}
      {doc.paragraphs.map((paragraph, index) =>
        paragraph.startsWith("## ") ? (
          <h2 key={index} className="pt-2 text-base font-semibold text-foreground">
            {paragraph.slice(3)}
          </h2>
        ) : (
          <p key={index}>{fillLegalText(paragraph, identity)}</p>
        ),
      )}
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
