import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toPublicErrorMessage } from "@/lib/public-error";
import { Save, Lock, Phone, Mail } from "lucide-react";
import {
  useSiteSettings,
  DEFAULT_FOUNDER_CONTACT,
  type FounderContactInfo,
} from "@/hooks/useSiteSettings";
import { updateFounderContact } from "@/lib/founder.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPhoneDisplay } from "@/lib/phone";

export function ContactPanel() {
  const { founderContact, refresh, isFounder } = useSiteSettings();
  const save = useServerFn(updateFounderContact);
  const [form, setForm] = useState<FounderContactInfo>(founderContact);

  useEffect(() => setForm(founderContact), [founderContact]);

  const mutation = useMutation({
    mutationFn: (values: FounderContactInfo) => save({ data: values }),
    onSuccess: () => {
      toast.success("İletişim bilgileri güncellendi");
      refresh();
    },
    onError: (error: Error) => toast.error(toPublicErrorMessage(error)),
  });

  if (!isFounder) {
    return (
      <div className="rounded-3xl border border-border bg-card p-6">
        <h2 className="flex items-center gap-2 text-xl">
          <Lock className="size-5 text-muted-foreground" /> Yetkiniz yok
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          İletişim bilgilerini yalnızca sayfa yöneticisi rolüne sahip hesaplar düzenleyebilir.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-6">
      <h2 className="text-xl">Sayfa yöneticisi iletişim bilgileri</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Ana sayfadaki "Sayfa yöneticisi ile iletişim" bölümünde gösterilen telefon ve e-posta
        adresini buradan güncelleyin.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold">Telefon</span>
          <Input
            value={form.founder_contact_phone}
            onChange={(event) => setForm({ ...form, founder_contact_phone: event.target.value })}
            className="mt-1.5 rounded-xl"
            inputMode="tel"
          />
          <span className="mt-1 block text-xs text-muted-foreground">Örn: 0546 696 31 33</span>
        </label>
        <label className="block">
          <span className="text-sm font-semibold">E-posta</span>
          <Input
            value={form.founder_contact_email}
            onChange={(event) => setForm({ ...form, founder_contact_email: event.target.value })}
            className="mt-1.5 rounded-xl"
            type="email"
          />
        </label>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-muted/40 p-4">
        <p className="text-sm font-semibold text-muted-foreground">Önizleme</p>
        <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
          <span className="inline-flex items-center gap-2">
            <Phone className="size-4 text-muted-foreground" />
            {formatPhoneDisplay(form.founder_contact_phone)}
          </span>
          <span className="inline-flex items-center gap-2">
            <Mail className="size-4 text-muted-foreground" />
            {form.founder_contact_email}
          </span>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          className="rounded-full"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate(form)}
        >
          <Save className="size-4" />
          {mutation.isPending ? "Kaydediliyor…" : "Kaydet"}
        </Button>
        <Button
          variant="outline"
          className="rounded-full"
          onClick={() => setForm(DEFAULT_FOUNDER_CONTACT)}
        >
          Varsayılana dön
        </Button>
      </div>
    </div>
  );
}
