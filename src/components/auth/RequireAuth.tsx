import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

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
          <Link to="/auth">Giriş yap</Link>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}