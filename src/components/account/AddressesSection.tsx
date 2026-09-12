import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { listAddresses, saveAddress, deleteAddress } from "@/lib/addresses.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const emptyForm = {
  label: "Ev",
  recipient_name: "",
  phone: "",
  city: "",
  district: "",
  street: "",
  directions: "",
  is_default: false,
};

export function AddressesSection() {
  const fetchAddresses = useServerFn(listAddresses);
  const persistAddress = useServerFn(saveAddress);
  const removeAddress = useServerFn(deleteAddress);
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);

  const {
    data: addresses = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["addresses"],
    queryFn: () => fetchAddresses(),
  });

  const save = useMutation({
    mutationFn: () =>
      persistAddress({
        data: {
          label: form.label,
          recipient_name: form.recipient_name,
          phone: form.phone,
          city: form.city,
          district: form.district,
          street: form.street,
          directions: form.directions || null,
          is_default: form.is_default,
        },
      }),
    onSuccess: () => {
      toast.success("Adres kaydedildi.");
      setForm(emptyForm);
      void queryClient.invalidateQueries({ queryKey: ["addresses"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Adres kaydedilemedi."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeAddress({ data: { id } }),
    onSuccess: () => {
      toast.success("Adres silindi.");
      void queryClient.invalidateQueries({ queryKey: ["addresses"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Adres silinemedi."),
  });

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
      <div className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Yükleniyor…</p>
        ) : isError ? (
          <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center">
            <p className="text-sm font-semibold">Adresler yüklenemedi</p>
            <Button className="mt-4 rounded-full" onClick={() => void refetch()}>
              Tekrar dene
            </Button>
          </div>
        ) : addresses.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Henüz kayıtlı adresiniz yok.
          </p>
        ) : (
          addresses.map((address) => (
            <div
              key={address.id}
              className="flex items-start gap-4 rounded-3xl border border-border/70 bg-card p-4 shadow-card"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {address.label}
                  {address.is_default ? (
                    <span className="ml-2 rounded-full bg-warm px-2 py-0.5 text-[11px] text-warm-foreground">
                      varsayılan
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {address.recipient_name} · {address.phone}
                </p>
                <p className="text-sm text-muted-foreground">
                  {address.street}, {address.district}/{address.city}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="size-9 rounded-full text-muted-foreground"
                aria-label={`${address.label} adresini sil`}
                onClick={() => remove.mutate(address.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))
        )}
      </div>

      <form
        className="space-y-3 rounded-3xl border border-border/70 bg-card p-5 shadow-card"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <p className="font-semibold">Yeni adres ekle</p>
        {(
          [
            ["label", "Adres adı"],
            ["recipient_name", "Ad soyad"],
            ["phone", "Telefon"],
            ["city", "Şehir"],
            ["district", "İlçe"],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="space-y-1.5">
            <Label htmlFor={key}>{label}</Label>
            <Input
              id={key}
              value={form[key]}
              onChange={(event) => setForm({ ...form, [key]: event.target.value })}
              required
              className="rounded-xl"
            />
          </div>
        ))}
        <div className="space-y-1.5">
          <Label htmlFor="street">Açık adres</Label>
          <Textarea
            id="street"
            value={form.street}
            onChange={(event) => setForm({ ...form, street: event.target.value })}
            required
            className="rounded-xl"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="directions">Yol tarifi (opsiyonel)</Label>
          <Input
            id="directions"
            value={form.directions}
            onChange={(event) => setForm({ ...form, directions: event.target.value })}
            className="rounded-xl"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={form.is_default}
            onChange={(event) => setForm({ ...form, is_default: event.target.checked })}
          />
          Varsayılan adres yap
        </label>
        <Button type="submit" disabled={save.isPending} className="w-full rounded-full">
          Adresi kaydet
        </Button>
      </form>
    </div>
  );
}
