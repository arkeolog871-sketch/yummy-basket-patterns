import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSellerDisclosure } from "@/lib/compliance.functions";

/** Satıcı (işletme) ile platform rolünü ayrıştıran bilgi kutusu. */
export function SellerDisclosure({ restaurantId }: { restaurantId: string }) {
  const fetchSeller = useServerFn(getSellerDisclosure);
  const { data } = useQuery({
    queryKey: ["seller-disclosure", restaurantId],
    queryFn: () => fetchSeller({ data: { restaurantId } }),
    staleTime: 5 * 60_000,
  });
  if (!data) return null;
  const address = [data.address, data.district, data.city].filter(Boolean).join(", ");
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4 text-xs leading-5 text-muted-foreground">
      <p className="font-semibold text-foreground">Satıcı: {data.legal_name || data.name}</p>
      {address ? <p>Adres: {address}</p> : null}
      {data.contact_phone ? <p>Telefon: {data.contact_phone}</p> : null}
      {data.contact_email ? <p>E-posta: {data.contact_email}</p> : null}
      {data.tax_office ? <p>Vergi dairesi: {data.tax_office}</p> : null}
      {data.mersis_no ? <p>MERSİS: {data.mersis_no}</p> : null}
      {data.opens_at && data.closes_at ? (
        <p>
          Çalışma saatleri: {String(data.opens_at).slice(0, 5)}–{String(data.closes_at).slice(0, 5)}
        </p>
      ) : null}
      <p>Teslimat: {data.delivery_type === "gel_al" ? "Gel-al" : "İşletme teslim eder"}</p>
      {!data.legal_name ? (
        <p className="mt-1 text-foreground">Satıcının resmi unvan bilgisi doğrulama sürecindedir.</p>
      ) : null}
      <p className="mt-2">
        Bu siparişte satıcı yukarıdaki işletmedir. SİLVAN CEBİMDE aracı hizmet sağlayıcıdır;
        platformun mevzuattan doğan yükümlülükleri saklıdır.{" "}
        <a href="/hizmet-saglayici-bilgileri" className="underline underline-offset-4">
          Platform bilgileri
        </a>
      </p>
    </div>
  );
}
