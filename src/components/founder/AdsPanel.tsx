import { useMemo, useRef, useState, type FormEvent, type RefObject } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ImageUp, Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import { toPublicErrorMessage } from "@/lib/public-error";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteAdvertisement,
  listAdvertisements,
  saveAdvertisement,
  setAdvertisementActive,
} from "@/lib/advertisements.functions";
import {
  emptyAdvertisementDraft,
  formatCtr,
  fromDatetimeLocalValue,
  isAdExpired,
  isAdScheduled,
  MAX_ADVERTISEMENTS,
  parsePublicBanner,
  toDatetimeLocalValue,
  type AdActionType,
  type Advertisement,
} from "@/lib/advertisements";
import { HeroBannerSlider } from "@/components/home/HeroBannerSlider";
import { AdMedia } from "@/components/home/AdMedia";
import {
  adImageTooLargeMessage,
  adImageTypeRejectedMessage,
  AD_MEDIA_ACCEPT,
  extensionForAdMediaFile,
  isAdMediaFile,
  MAX_AD_IMAGE_MB,
  MAX_AD_MEDIA_BYTES,
} from "@/lib/upload-limits";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ACTION_LABELS: Record<AdActionType, string> = {
  phone: "Telefon",
  internal_route: "Uygulama içi sayfa",
  external_link: "Harici bağlantı",
};

type Draft = ReturnType<typeof emptyAdvertisementDraft> & { id?: string };

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("Dosya okunamadı"));
    reader.readAsDataURL(file);
  });
}

function toDraft(ad?: Advertisement | null): Draft {
  if (!ad) return emptyAdvertisementDraft();
  const { id, title, client_name, client_phone, image_url, action_type, action_value, display_order, is_active, start_date, end_date } = ad;
  return {
    id,
    title,
    client_name,
    client_phone,
    image_url,
    action_type,
    action_value,
    display_order,
    is_active,
    start_date,
    end_date,
  };
}

export function AdsPanel() {
  const { isFounder } = useSiteSettings();
  const queryClient = useQueryClient();
  const listFn = useServerFn(listAdvertisements);
  const saveFn = useServerFn(saveAdvertisement);
  const toggleFn = useServerFn(setAdvertisementActive);
  const deleteFn = useServerFn(deleteAdvertisement);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const localPreviewRef = useRef("");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyAdvertisementDraft());
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [localPreview, setLocalPreview] = useState("");
  const [pickedName, setPickedName] = useState("");

  const query = useQuery({
    queryKey: ["founder-advertisements"],
    enabled: isFounder,
    queryFn: () => listFn(),
    retry: false,
  });

  const liveBannersQuery = useQuery({
    queryKey: ["public-banners"],
    enabled: isFounder,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_active_banners");
      if (error) throw new Error(error.message);
      return (Array.isArray(data) ? data : [])
        .map(parsePublicBanner)
        .filter((item) => item != null);
    },
    retry: false,
  });

  const items = query.data?.items ?? [];

  const toggleMutation = useMutation({
    mutationFn: (input: { id: string; is_active: boolean }) => toggleFn({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["founder-advertisements"] });
      void queryClient.invalidateQueries({ queryKey: ["public-banners"] });
    },
    onError: (error: Error) => toast.error(toPublicErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Reklam silindi");
      void queryClient.invalidateQueries({ queryKey: ["founder-advertisements"] });
      void queryClient.invalidateQueries({ queryKey: ["public-banners"] });
    },
    onError: (error: Error) => toast.error(toPublicErrorMessage(error)),
  });

  function clearLocalPreview() {
    if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
    localPreviewRef.current = "";
    setLocalPreview("");
  }

  function resetMedia() {
    setFile(null);
    setPickedName("");
    clearLocalPreview();
  }

  function onPickFile(next: File) {
    if (!isAdMediaFile(next)) {
      toast.error(adImageTypeRejectedMessage());
      return;
    }
    if (next.size > MAX_AD_MEDIA_BYTES) {
      toast.error(adImageTooLargeMessage());
      return;
    }
    const extension = extensionForAdMediaFile(next);
    if (!extension) {
      toast.error(adImageTypeRejectedMessage());
      return;
    }
    if (extension === "heic" || extension === "heif") {
      toast.message("HEIC bazı tarayıcılarda görünmez; mümkünse JPEG veya PNG seçin");
    }
    clearLocalPreview();
    setFile(next);
    setPickedName(next.name || "görsel");
    const blobUrl = URL.createObjectURL(next);
    localPreviewRef.current = blobUrl;
    setLocalPreview(blobUrl);
    setDraft((prev) => ({ ...prev, image_url: "" }));
  }

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault();
    const title = draft.title.trim();
    if (!title) {
      toast.error("Başlık girin");
      return;
    }
    if (!file && !draft.image_url.trim()) {
      toast.error("Galeriden bir görsel veya video seçin");
      return;
    }
    if (loading) return;

    setLoading(true);
    try {
      const base64 = file ? await fileToBase64(file) : undefined;
      await saveFn({
        data: {
          ...(draft.id ? { id: draft.id } : {}),
          title,
          client_name: draft.client_name,
          client_phone: draft.client_phone,
          image_url: draft.image_url.trim(),
          action_type: draft.action_type,
          action_value: draft.action_value,
          display_order: draft.display_order,
          is_active: draft.is_active,
          start_date: draft.start_date,
          end_date: draft.end_date,
          ...(file && base64
            ? {
                fileName: file.name || "reklam",
                contentType: file.type || "application/octet-stream",
                base64,
              }
            : {}),
        },
      });
      toast.success("Reklam kaydedildi");
      resetMedia();
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["founder-advertisements"] });
      void queryClient.invalidateQueries({ queryKey: ["public-banners"] });
    } catch (error) {
      toast.error(toPublicErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const tablePreview = useMemo(
    () =>
      items
        .filter((ad) => ad.is_active && !isAdExpired(ad) && !isAdScheduled(ad) && ad.image_url)
        .map((ad) => ({
          id: ad.id,
          title: ad.title,
          image_url: ad.image_url,
          action_type: ad.action_type,
          action_value: ad.action_value,
          display_order: ad.display_order,
        })),
    [items],
  );
  const livePreview =
    liveBannersQuery.data && liveBannersQuery.data.length > 0 ? liveBannersQuery.data : tablePreview;

  if (!isFounder) {
    return (
      <div className="rounded-3xl border border-border bg-card p-6">
        <h2 className="text-xl">Reklam yönetimi</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Kayan reklam panosunu yalnızca kurucu hesaplar düzenleyebilir.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Megaphone className="size-4 text-accent" />
              <h2 className="text-xl">Kayan reklam / banner</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Galeriden seçilen görsel veya video `banners` kovasına yüklenir ve reklam kaydı yazılır.
              Ana sayfa yayındaki slaytları gösterir. En fazla {MAX_ADVERTISEMENTS} kayıt önerilir.
            </p>
          </div>
          <Button
            type="button"
            className="rounded-full"
            onClick={() => {
              resetMedia();
              setDraft(emptyAdvertisementDraft());
              setOpen(true);
            }}
          >
            <Plus className="size-4" />
            Reklam ekle
          </Button>
        </div>

        {livePreview.length > 0 ? (
          <div className="mt-5">
            <p className="mb-2 text-sm font-medium">Canlı önizleme (yayındaki slaytlar)</p>
            <HeroBannerSlider banners={livePreview} preview />
          </div>
        ) : (
          <p className="mt-5 rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            Şu an yayında slayt yok. Tarih aralığı içinde ve aktif olanlar ana sayfada görünür.
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reklam</TableHead>
              <TableHead>Esnaf</TableHead>
              <TableHead>Aksiyon</TableHead>
              <TableHead>Tarih</TableHead>
              <TableHead className="text-right">Gösterim</TableHead>
              <TableHead className="text-right">Tıklama</TableHead>
              <TableHead className="text-right">CTR</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                  {query.isLoading
                    ? "Yükleniyor…"
                    : query.isError
                      ? toPublicErrorMessage(query.error)
                      : "Henüz reklam yok."}
                </TableCell>
              </TableRow>
            ) : (
              items.map((ad) => {
                const expired = isAdExpired(ad);
                const scheduled = isAdScheduled(ad);
                return (
                  <TableRow key={ad.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-20 overflow-hidden rounded-lg border bg-muted">
                          {ad.image_url ? (
                            <AdMedia src={ad.image_url} className="size-full object-cover" />
                          ) : null}
                        </div>
                        <div>
                          <p className="font-medium">{ad.title}</p>
                          <p className="text-[11px] text-muted-foreground">sıra {ad.display_order}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p>{ad.client_name || "—"}</p>
                      <p className="text-[11px] text-muted-foreground">{ad.client_phone || ""}</p>
                    </TableCell>
                    <TableCell>
                      <p>{ACTION_LABELS[ad.action_type]}</p>
                      <p className="max-w-[140px] truncate text-[11px] text-muted-foreground">{ad.action_value}</p>
                    </TableCell>
                    <TableCell className="text-xs">
                      <p>{new Date(ad.start_date).toLocaleString("tr-TR")}</p>
                      <p className="text-muted-foreground">{new Date(ad.end_date).toLocaleString("tr-TR")}</p>
                      {expired ? (
                        <span className="mt-1 inline-flex rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                          Süresi doldu
                        </span>
                      ) : scheduled ? (
                        <span className="mt-1 inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">
                          Zamanlandı
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right font-medium">{ad.impression_count}</TableCell>
                    <TableCell className="text-right font-medium">{ad.click_count}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCtr(ad.impression_count, ad.click_count)}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={ad.is_active && !expired}
                        disabled={expired || toggleMutation.isPending}
                        onCheckedChange={(is_active) => toggleMutation.mutate({ id: ad.id, is_active })}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            resetMedia();
                            setDraft(toDraft(ad));
                            setOpen(true);
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => {
                            if (window.confirm("Bu reklam silinsin mi?")) deleteMutation.mutate(ad.id);
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) resetMedia();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Reklamı düzenle" : "Yeni reklam"}</DialogTitle>
          </DialogHeader>
          <AdForm
            draft={draft}
            setDraft={setDraft}
            previewSrc={localPreview || draft.image_url}
            loading={loading}
            fileRef={fileRef}
            pickedName={pickedName}
            onPickFile={onPickFile}
            onSubmit={handleUpload}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdForm({
  draft,
  setDraft,
  previewSrc,
  loading,
  fileRef,
  pickedName,
  onPickFile,
  onSubmit,
}: {
  draft: Draft;
  setDraft: (next: Draft) => void;
  previewSrc: string;
  loading: boolean;
  fileRef: RefObject<HTMLInputElement | null>;
  pickedName: string;
  onPickFile: (file: File) => void;
  onSubmit: (e: FormEvent) => void | Promise<void>;
}) {
  const patch = (partial: Partial<Draft>) => setDraft({ ...draft, ...partial });
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        void onSubmit(event);
      }}
    >
      <div>
        <Label htmlFor="ad-title">Başlık</Label>
        <Input
          id="ad-title"
          value={draft.title}
          maxLength={120}
          required
          onChange={(event) => patch({ title: event.target.value })}
          className="mt-1"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="ad-client">Advertisör / esnaf adı</Label>
          <Input
            id="ad-client"
            value={draft.client_name}
            maxLength={80}
            onChange={(event) => patch({ client_name: event.target.value })}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="ad-phone">Esnaf telefonu</Label>
          <Input
            id="ad-phone"
            value={draft.client_phone}
            inputMode="tel"
            onChange={(event) => patch({ client_phone: event.target.value })}
            className="mt-1"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="ad-media-file">
          Görsel veya video (PNG, JPEG, MP4, MOV, WEBM… en fazla {MAX_AD_IMAGE_MB} MB, 16:9 veya 3:1)
        </Label>
        <div className="mt-1.5 flex items-center gap-3">
          <div className="h-16 w-28 overflow-hidden rounded-xl border bg-muted">
            {previewSrc ? <AdMedia src={previewSrc} className="size-full object-cover" active /> : null}
          </div>
          <label
            htmlFor="ad-media-file"
            className={cn(buttonVariants({ variant: "default" }), "relative cursor-pointer rounded-full")}
          >
            <input
              ref={fileRef}
              id="ad-media-file"
              type="file"
              accept={AD_MEDIA_ACCEPT}
              className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
              style={{ fontSize: 16 }}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) onPickFile(file);
              }}
            />
            <span className="pointer-events-none inline-flex items-center gap-2">
              <ImageUp className="size-4" />
              {loading ? "Yükleniyor…" : "Galeriden seç"}
            </span>
          </label>
        </div>
        {pickedName || previewSrc ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {pickedName ? `${pickedName} seçildi. Kaydet ile yüklenecek.` : "Görsel hazır."}
          </p>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="ad-action">Tıklama aksiyonu</Label>
          <select
            id="ad-action"
            className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            value={draft.action_type}
            onChange={(event) => patch({ action_type: event.target.value as AdActionType })}
          >
            <option value="phone">Telefon ara</option>
            <option value="internal_route">Uygulama içi sayfa</option>
            <option value="external_link">Harici bağlantı</option>
          </select>
        </div>
        <div>
          <Label htmlFor="ad-target">Hedef</Label>
          <Input
            id="ad-target"
            value={draft.action_value}
            placeholder={
              draft.action_type === "phone"
                ? "+90…"
                : draft.action_type === "external_link"
                  ? "https://"
                  : "/restoranlar"
            }
            onChange={(event) => patch({ action_value: event.target.value })}
            className="mt-1"
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="ad-start">Yayın başlangıcı</Label>
          <Input
            id="ad-start"
            type="datetime-local"
            value={toDatetimeLocalValue(draft.start_date)}
            onChange={(event) => patch({ start_date: fromDatetimeLocalValue(event.target.value) })}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="ad-end">Yayın bitişi</Label>
          <Input
            id="ad-end"
            type="datetime-local"
            value={toDatetimeLocalValue(draft.end_date)}
            onChange={(event) => patch({ end_date: fromDatetimeLocalValue(event.target.value) })}
            className="mt-1"
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="ad-order">Gösterim sırası</Label>
          <Input
            id="ad-order"
            type="number"
            min={0}
            max={9999}
            value={draft.display_order}
            onChange={(event) => patch({ display_order: Number(event.target.value) || 0 })}
            className="mt-1"
          />
        </div>
        <div className="flex items-end justify-between rounded-xl border px-3 py-2">
          <div>
            <p className="text-sm font-medium">Yayında</p>
            <p className="text-[11px] text-muted-foreground">Tarihi dolanlar otomatik pasif</p>
          </div>
          <Switch checked={draft.is_active} onCheckedChange={(is_active) => patch({ is_active })} />
        </div>
      </div>
      <Button type="submit" className="w-full rounded-full">
        {loading ? "Kaydediliyor…" : "Kaydet"}
      </Button>
    </form>
  );
}
