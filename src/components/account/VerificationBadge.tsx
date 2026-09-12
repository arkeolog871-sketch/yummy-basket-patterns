import { CheckCircle2, CircleAlert } from "lucide-react";

export function VerificationBadge({ verified, label }: { verified: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
        verified ? "bg-success/15 text-success" : "bg-warm text-warm-foreground"
      }`}
    >
      {verified ? <CheckCircle2 className="size-3.5" /> : <CircleAlert className="size-3.5" />}
      {label}
    </span>
  );
}
