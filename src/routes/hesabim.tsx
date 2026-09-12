import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, MapPin, ShieldCheck, User } from "lucide-react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { AddressesSection } from "@/components/account/AddressesSection";
import { DeleteAccountSection } from "@/components/account/DeleteAccountSection";
import { OrdersSection } from "@/components/account/OrdersSection";
import { ProfileSection } from "@/components/account/ProfileSection";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getMyProfile } from "@/lib/profile.functions";

const TABS = ["profil", "siparisler", "adresler", "hesap"] as const;
type AccountTab = (typeof TABS)[number];

type AccountSearch = { sekme?: AccountTab };

export const Route = createFileRoute("/hesabim")({
  validateSearch: (search: Record<string, unknown>): AccountSearch => {
    const value = search["sekme"];
    return typeof value === "string" && (TABS as readonly string[]).includes(value)
      ? { sekme: value as AccountTab }
      : {};
  },
  head: () => ({
    meta: [
      { title: "Hesabım — SİLVAN CEBİMDE" },
      {
        name: "description",
        content:
          "Kişisel bilgilerinizi düzenleyin, sipariş geçmişinizi ve adreslerinizi yönetin, hesabınızın silinmesini talep edin.",
      },
      { property: "og:title", content: "Hesabım — SİLVAN CEBİMDE" },
      {
        property: "og:description",
        content: "Kişisel bilgiler, siparişler, adresler ve hesap yönetimi tek yerde.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireAuth>
      <AccountPage />
    </RequireAuth>
  ),
});

/**
 * Sipariş ve adres sunucu fonksiyonları doğrulanmış e-posta ister
 * (assertVerifiedEmail). Hesabım sayfası doğrulanmamış kullanıcıyı da içeri
 * alır — doğrulama zaten burada yapılıyor — bu yüzden o sekmeler hata
 * göstermek yerine kullanıcıyı Kişisel bilgiler sekmesine yönlendirir.
 */
function VerifyFirst({ onGoToProfile }: { onGoToProfile: () => void }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center">
      <p className="font-semibold">Önce e-posta adresinizi doğrulayın</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Sipariş geçmişiniz ve adresleriniz, hesabınız doğrulandıktan sonra görüntülenir.
      </p>
      <Button className="mt-5 rounded-full" onClick={onGoToProfile}>
        Kişisel bilgilere git
      </Button>
    </div>
  );
}

function AccountPage() {
  const { sekme } = Route.useSearch();
  const navigate = useNavigate({ from: "/hesabim" });
  const fetchProfile = useServerFn(getMyProfile);

  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => fetchProfile(),
  });
  const verified = Boolean(profile?.email_verified);

  const activeTab: AccountTab = sekme ?? "profil";
  const setTab = (next: string) =>
    void navigate({ search: next === "profil" ? {} : { sekme: next as AccountTab } });

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <h1 className="text-3xl">Hesabım</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Kişisel bilgileriniz, sipariş geçmişiniz, adresleriniz ve hesap ayarlarınız tek yerde.
      </p>

      <Tabs value={activeTab} onValueChange={setTab} className="mt-6">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-2xl p-1">
          <TabsTrigger value="profil" className="gap-1.5 rounded-xl">
            <User className="size-4" /> Kişisel bilgiler
          </TabsTrigger>
          <TabsTrigger value="siparisler" className="gap-1.5 rounded-xl">
            <ClipboardList className="size-4" /> Siparişlerim
          </TabsTrigger>
          <TabsTrigger value="adresler" className="gap-1.5 rounded-xl">
            <MapPin className="size-4" /> Adreslerim
          </TabsTrigger>
          <TabsTrigger value="hesap" className="gap-1.5 rounded-xl">
            <ShieldCheck className="size-4" /> Hesap
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profil" className="mt-6">
          <ProfileSection />
        </TabsContent>

        <TabsContent value="siparisler" className="mt-6">
          {verified ? <OrdersSection /> : <VerifyFirst onGoToProfile={() => setTab("profil")} />}
        </TabsContent>

        <TabsContent value="adresler" className="mt-6">
          {verified ? <AddressesSection /> : <VerifyFirst onGoToProfile={() => setTab("profil")} />}
        </TabsContent>

        <TabsContent value="hesap" className="mt-6 space-y-6">
          <section className="rounded-3xl border border-border/70 bg-card p-5 shadow-card">
            <p className="font-semibold">Bildirimler ve yasal metinler</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild variant="outline" className="rounded-full">
                <Link to="/bildirimler">Bildirimlerim</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full">
                <Link to="/kvkk">KVKK Aydınlatma Metni</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full">
                <Link to="/gizlilik-politikasi">Gizlilik Politikası</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full">
                <Link to="/kullanim-kosullari">Kullanım Koşulları</Link>
              </Button>
            </div>
          </section>

          <DeleteAccountSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
