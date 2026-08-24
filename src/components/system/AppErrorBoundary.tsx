import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportLovableError } from "@/lib/lovable-error-reporting";

type Props = { children: ReactNode; fallback?: ReactNode };
type State = { hasError: boolean };

/** Ayar/Supabase hatalarının tüm ağacı indirmesini önler. */
export class AppErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error);
    reportLovableError(error, {
      boundary: "app_error_boundary",
      componentStack: info.componentStack ?? "",
    });
  }

  override render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="font-semibold">Sayfa varsayılan görünümle açıldı</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Bazı canlı veriler yüklenemedi. Alışverişe devam edebilir veya sayfayı yenileyebilirsiniz.
        </p>
        <a
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Ana sayfa
        </a>
      </div>
    );
  }
}
