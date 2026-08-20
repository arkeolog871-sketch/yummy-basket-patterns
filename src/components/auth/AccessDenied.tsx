import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ShieldAlert } from "lucide-react";
import { useAccess } from "@/hooks/useAccess";
import { Button } from "@/components/ui/button";

/** 403 ekranı: yetkisiz alanlara elle girilen URL'lerde kullanıcıyı kendi paneline döndürür. */
export function AccessDenied({
  message = "Bu alana erişim yetkiniz yok.",
  autoRedirect = true,
}: {
  message?: string;
  autoRedirect?: boolean;
}) {
  const { loading, homePath, role } = useAccess();
  const navigate = useNavigate();

  useEffect(() => {
    if (!autoRedirect || loading) return;
    const timer = window.setTimeout(() => {
      void navigate({ to: homePath, replace: true });
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [autoRedirect, loading, homePath, navigate]);

  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <span className="mx-auto flex size-14 items-center justify-center rounded-3xl bg-destructive/10 text-destructive">
        <ShieldAlert className="size-6" />
      </span>
      <h1 className="mt-5 text-3xl">403 · Erişim reddedildi</h1>
      <p className="mt-3 text-sm text-muted-foreground">{message}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Mevcut rolünüz: {role === "guest" ? "misafir" : role}
        {autoRedirect ? " · Kendi panelinize yönlendiriliyorsunuz…" : null}
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <Button asChild className="rounded-full">
          <Link to={homePath}>Kendi panelime dön</Link>
        </Button>
        <Button asChild variant="outline" className="rounded-full">
          <Link to="/">Ana sayfa</Link>
        </Button>
      </div>
    </div>
  );
}
