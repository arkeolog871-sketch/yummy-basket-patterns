import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

/** Yeni işletmelerde boş listelerin çökmemesi için ortak boş durum göstergesi. */
export function EmptyState({
  title,
  description,
  icon,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        {icon ?? <Inbox className="size-5" />}
      </span>
      <p className="mt-4 font-semibold">{title}</p>
      {description ? (
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
