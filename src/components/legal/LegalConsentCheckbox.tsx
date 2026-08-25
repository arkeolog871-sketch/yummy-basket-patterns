import { useState } from "react";
import { LEGAL_DOCUMENTS, type LegalDocId } from "@/lib/legal";
import { LegalDocumentBody } from "@/components/legal/LegalDocument";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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

/** OTP doğrulama adımındaki zorunlu yasal onay kutusu. */
export function LegalConsentCheckbox({ id, checked, disabled, onCheckedChange }: Props) {
  const [openDoc, setOpenDoc] = useState<LegalDocId | null>(null);
  const active = openDoc ? LEGAL_DOCUMENTS[openDoc] : null;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/30 p-3">
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className="mt-0.5"
        aria-required
      />
      <Label htmlFor={id} className="text-xs font-normal leading-5 text-muted-foreground">
        <LegalDocLink docId="terms" onOpen={setOpenDoc} />
        {", "}
        <LegalDocLink docId="privacy" onOpen={setOpenDoc} />
        {" ve "}
        <LegalDocLink docId="kvkk" onOpen={setOpenDoc} />
        {"'ni okudum, kabul ediyorum."}
      </Label>

      <Dialog open={Boolean(openDoc)} onOpenChange={(open) => !open && setOpenDoc(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
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

function LegalDocLink({
  docId,
  onOpen,
}: {
  docId: LegalDocId;
  onOpen: (id: LegalDocId) => void;
}) {
  const doc = LEGAL_DOCUMENTS[docId];
  return (
    <a
      href={doc.path}
      target="_blank"
      rel="noreferrer"
      className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onOpen(docId);
      }}
    >
      {doc.title}
    </a>
  );
}
