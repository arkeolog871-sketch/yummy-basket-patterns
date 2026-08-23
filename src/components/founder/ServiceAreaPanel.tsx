import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toPublicErrorMessage } from "@/lib/public-error";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { useServiceAreas, type ServiceArea } from "@/hooks/useTaxonomy";
import { saveServiceArea, deleteServiceArea } from "@/lib/taxonomy.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const emptyForm = { city: "", district: "", position: 0, is_active: true };

export function ServiceAreaPanel() {
  const { areas } = useServiceAreas({ includeHidden: true });
  const queryClient = useQueryClient();
  const save = useServerFn(saveServiceArea);
  const remove = useServerFn(deleteServiceArea);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["service-areas"] });
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          ...(editingId ? { id: editingId } : {}),
          city: form.city,
          district: form.district,
          position: Number(form.position),
          is_active: form.is_active,
        },
      }),
    onSuccess: () => {
      toast.success(editingId ? "Bölge güncellendi" : "Bölge eklendi");
      setEditingId(null);
      setForm(emptyForm);
      refresh();
    },
    onError: (error: Error) => toast.error(toPublicErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Bölge kaldırıldı");
      refresh();
    },
    onError: (error: Error) => toast.error(toPublicErrorMessage(error)),
  });

  function startEdit(area: ServiceArea) {
    setEditingId(area.id);
    setForm({
      city: area.city,
      district: area.district,
      position: area.position,
      is_active: area.is_active,
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <form
        className="space-y-4 rounded-3xl border border-border bg-card p-6"
        onSubmit={(event) => {
          event.preventDefault();
          saveMutation.mutate();
        }}
      >
        <p className="text-sm font-semibold">
          {editingId ? "Bölgeyi düzenle" : "Yeni teslimat bölgesi"}
        </p>
        <div>
          <Label htmlFor="area-city">Şehir</Label>
          <Input
            id="area-city"
            className="mt-1.5"
            required
            value={form.city}
            onChange={(event) => setForm({ ...form, city: event.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="area-district">İlçe / bölge</Label>
          <Input
            id="area-district"
            className="mt-1.5"
            required
            value={form.district}
            onChange={(event) => setForm({ ...form, district: event.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="area-position">Sıra</Label>
          <Input
            id="area-position"
            type="number"
            min={0}
            className="mt-1.5"
            value={form.position}
            onChange={(event) => setForm({ ...form, position: Number(event.target.value) })}
          />
        </div>
        <div className="flex items-center justify-between rounded-2xl border border-border p-3">
          <span className="text-sm">Hizmet veriliyor</span>
          <Switch
            checked={form.is_active}
            onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" className="rounded-full" disabled={saveMutation.isPending}>
            <Plus className="size-4" /> {editingId ? "Kaydet" : "Ekle"}
          </Button>
          {editingId ? (
            <Button
              type="button"
              variant="ghost"
              className="rounded-full"
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm);
              }}
            >
              Vazgeç
            </Button>
          ) : null}
        </div>
      </form>

      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        {areas.map((area) => (
          <div
            key={area.id}
            className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 p-4 last:border-0"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-warm text-warm-foreground">
                <MapPin className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {area.district}, {area.city}
                  {area.is_active ? null : (
                    <span className="ml-2 text-xs text-muted-foreground">(kapalı)</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">sıra {area.position}</p>
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                size="icon"
                variant="outline"
                className="rounded-full"
                aria-label="Düzenle"
                onClick={() => startEdit(area)}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="rounded-full"
                aria-label="Sil"
                onClick={() => deleteMutation.mutate(area.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}