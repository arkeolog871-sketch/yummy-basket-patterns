import { createFileRoute } from "@tanstack/react-router";
import { AccessDenied } from "@/components/auth/AccessDenied";

export const Route = createFileRoute("/admin/$")({
  head: () => ({
    meta: [
      { title: "Erişim reddedildi — SİLVAN CEBİMDE" },
      { name: "description", content: "Bu yönetim alanına erişim yetkiniz bulunmuyor." },
      { property: "og:title", content: "Erişim reddedildi — SİLVAN CEBİMDE" },
      { property: "og:description", content: "Yetkisiz yönetim alanı erişimi engellendi." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <AccessDenied message="Bu yönetim alanı hesabınıza kapalı. Kendi panelinize yönlendiriliyorsunuz." />
  ),
});
