import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const redirect = pathname === "/odeme" ? "/odeme" : undefined;

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center text-sm text-muted-foreground">
        Yükleniyor…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="text-3xl">Giriş yapmanız gerekiyor</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Bu sayfayı görüntülemek için hesabınıza giriş yapın.
        </p>
        <Button asChild className="mt-6 rounded-full">
          <Link to="/auth" search={redirect ? { redirect } : {}}>
            Giriş yap
          </Link>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}