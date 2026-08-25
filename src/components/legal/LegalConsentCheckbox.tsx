import { useState } from "react";
import { LEGAL_DOCUMENTS, type LegalDocId } from "@/lib/legal";
import { LegalDocumentBody } from "@/components/legal/LegalDocument";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  id: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
};

/** OTP kodunun hemen altında görünen zorunlu yasal onay. */
export function LegalConsentCheckbox({ id, checked, disabled, onCheckedChange }: Props) {
  const [openDoc, setOpenDoc] = useState<LegalDocId | null>(null);
  const active = openDoc ? LEGAL_DOCUMENTS[openDoc] : null;

  return (
    <div className="mt-3 w-full rounded-xl border border-primary/40 bg-background p-3 shadow-sm">
      <label htmlFor={id} className="flex min-h-11 cursor-pointer items-start gap-3 touch-manipulation">
        <input
          id={id}
          name="termsAccepted"
          type="checkbox"
          required
          checked={checked}
          disabled={disabled}
          onChange={(event) => onCheckedChange(event.target.checked)}
          className="mt-0.5 size-6 shrink-0 accent-primary"
        />
        <span className="text-[16px] leading-6 text-foreground">
          <LegalDocButton docId="terms" onOpen={setOpenDoc} />
          {", "}
          <LegalDocButton docId="privacy" onOpen={setOpenDoc} />
          {" ve "}
          <LegalDocButton docId="kvkk" onOpen={setOpenDoc} />
          {"'ni okudum, kabul ediyorum."}
        </span>
      </label>

      <Dialog open={Boolean(openDoc)} onOpenChange={(open) => !open && setOpenDoc(null)}>
        <DialogContent className="max-h-[min(85vh,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2rem))] max-w-2xl overflow-y-auto pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {active ? (
            <>
              <DialogHeader>
                <DialogTitle>{active.title}</DialogTitle>
                <DialogDescription>{active.description}</DialogDescription>
              </DialogHeader>
              <LegalDocumentBody docId={active.id} />
              <DialogFooter>
                <a
                  href={active.path}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-primary underline-offset-4 hover:underline"
                >
                  Yeni sekmede aç
                </a>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LegalDocButton({
  docId,
  onOpen,
}: {
  docId: LegalDocId;
  onOpen: (id: LegalDocId) => void;
}) {
  const doc = LEGAL_DOCUMENTS[docId];
  return (
    <button
      type="button"
      className="inline p-0 font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onOpen(docId);
      }}
    >
      {doc.title}
    </button>
  );
}
