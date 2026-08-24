import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { reportAppError } from "@/lib/errors.functions";

/** Tarayıcıda oluşan çalışma zamanı hatalarını sistem hata kaydına gönderir. */
export function ErrorCollector() {
  const report = useServerFn(reportAppError);

  useEffect(() => {
    const seen = new Set<string>();

    const send = (message: string, stack?: string) => {
      const text = message.trim();
      if (!text || seen.has(text)) return;
      seen.add(text);
      void report({
        data: {
          message: text.slice(0, 1_000),
          ...(stack ? { stack: stack.slice(0, 8_000) } : {}),
          path: window.location.pathname + window.location.search,
        },
      }).catch(() => undefined);
    };

    const onError = (event: ErrorEvent) => {
      const error = event.error as Error | undefined;
      send(error?.message ?? event.message, error?.stack);
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      if (reason instanceof Error) send(reason.message, reason.stack);
      else send(typeof reason === "string" ? reason : "Beklenmeyen bir hata oluştu");
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [report]);

  return null;
}
