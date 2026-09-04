import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toPublicErrorMessage } from "@/lib/public-error";
import { ImageIcon, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/vendor/EmptyState";
import { ImageDropzone, readImageFile } from "@/components/vendor/ImageDropzone";
import {
  addVendorGalleryImages,
  removeVendorBrandImage,
  uploadVendorBrandImage,
  deleteVendorGalleryImage,
} from "@/lib/vendor-media.functions";

export type VendorMedia = { id: string; url: string; kind: string };

export function MediaPanel({
  logoUrl,
  coverUrl,
  media,
  onChanged,
}: {
  logoUrl: string | null;
  coverUrl: string | null;
  media: VendorMedia[];
  onChanged: () => void;
}) {
  const uploadBrand = useServerFn(uploadVendorBrandImage);
  const removeBrand = useServerFn(removeVendorBrandImage);
  const addGallery = useServerFn(addVendorGalleryImages);
  const deleteGallery = useServerFn(deleteVendorGalleryImage);
  const [busyKind, setBusyKind] = useState<"logo" | "cover" | "gallery" | null>(null);

  const brandMutation = useMutation({
    mutationFn: async (input: { kind: "logo" | "cover"; file: File }) => {
      const image = await readImageFile(input.file);
      return uploadBrand({
        data: {
          kind: input.kind,
          fileName: image.fileName,
          contentType: image.contentType,
          base64: image.base64,
        },
      });
    },
    onSuccess: (_data, variables) => {
      toast.success(variables.kind === "logo" ? "Logo güncellendi" : "Kapak görseli güncellendi");
      onChanged();
    },
    onError: (error: Error) => toast.error(toPublicErrorMessage(error)),
    onSettled: () => setBusyKind(null),
  });

  const brandRemoveMutation = useMutation({
    mutationFn: (kind: "logo" | "cover") => removeBrand({ data: { kind } }),
    onSuccess: () => {
      toast.success("Görsel kaldırıldı");
      onChanged();
    },
    onError: (error: Error) => toast.error(toPublicErrorMessage(error)),
  });

  const galleryMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const images = await Promise.all(files.slice(0, 10).map((file) => readImageFile(file)));
      return addGallery({
        data: {
          images: images.map((image) => ({
            fileName: image.fileName,
            contentType: image.contentType,
            base64: image.base64,
          })),
        },
      });
    },
    onSuccess: () => {
      toast.success("Görseller galeriye eklendi");
      onChanged();
    },
    onError: (error: Error) => toast.error(toPublicErrorMessage(error)),
    onSettled: () => setBusyKind(null),
  });

  const galleryDeleteMutation = useMutation({
    mutationFn: (id: string) => deleteGallery({ data: { id } }),
    onSuccess: () => {
      toast.success("Görsel silindi");
      onChanged();
    },
    onError: (error: Error) => toast.error(toPublicErrorMessage(error)),
  });

  function handleBrandFiles(kind: "logo" | "cover", files: File[]) {
    const file = files[0];
    if (!file) return;
    setBusyKind(kind);
    brandMutation.mutate({ kind, file });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <BrandCard
          title="İşletme logosu"
          description="Kare oranlı, arka planı temiz bir logo önerilir. Müşterilere yuvarlak rozet olarak gösterilir."
          url={logoUrl}
          aspect="square"
          busy={busyKind === "logo"}
          onFiles={(files) => handleBrandFiles("logo", files)}
          onRemove={() => brandRemoveMutation.mutate("logo")}
          removing={brandRemoveMutation.isPending}
        />
        <BrandCard
          title="Kapak görseli"
          description="Müşterilerin işletme sayfanızda gördüğü geniş (16:9) görsel."
          url={coverUrl}
          aspect="video"
          busy={busyKind === "cover"}
          onFiles={(files) => handleBrandFiles("cover", files)}
          onRemove={() => brandRemoveMutation.mutate("cover")}
          removing={brandRemoveMutation.isPending}
        />
      </div>

      <div className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-card">
        <div>
          <p className="font-semibold">İşletme galerisi</p>
          <p className="mt-1 text-sm text-muted-foreground">
            İç/dış mekan fotoğraflarınızı yükleyin; müşteriler işletme sayfanızda görür.
          </p>
        </div>
        <ImageDropzone
          multiple
          busy={busyKind === "gallery"}
          label="Birden çok görseli buraya sürükleyin veya seçin"
          hint="Tek seferde en fazla 10 görsel · her biri 4 MB"
          onFiles={(files) => {
            setBusyKind("gallery");
            galleryMutation.mutate(files);
          }}
        />

        {media.length === 0 ? (
          <EmptyState
            title="Galeride görsel yok"
            description="Yüklediğiniz görseller burada kart olarak listelenir."
            icon={<ImageIcon className="size-5" />}
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {media.map((item) => (
              <div
                key={item.id}
                className="group relative overflow-hidden rounded-2xl border border-border bg-muted"
              >
                <img
                  src={item.url}
                  alt="İşletme galeri görseli"
                  loading="lazy"
                  className="aspect-square size-full object-cover"
                />
                <Button
                  size="icon"
                  variant="secondary"
                  aria-label="Görseli sil"
                  className="absolute right-2 top-2 size-8 rounded-full"
                  disabled={galleryDeleteMutation.isPending}
                  onClick={() => galleryDeleteMutation.mutate(item.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BrandCard({
  title,
  description,
  url,
  aspect,
  busy,
  onFiles,
  onRemove,
  removing,
}: {
  title: string;
  description: string;
  url: string | null;
  aspect: "square" | "video";
  busy: boolean;
  onFiles: (files: File[]) => void;
  onRemove: () => void;
  removing: boolean;
}) {
  return (
    <div className="space-y-3 rounded-3xl border border-border bg-card p-5 shadow-card">
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {url ? (
        <div className="relative overflow-hidden rounded-2xl border border-border bg-muted">
          <img
            src={url}
            alt={title}
            className={`w-full object-cover ${aspect === "square" ? "aspect-square" : "aspect-video"}`}
          />
          <Button
            size="sm"
            variant="secondary"
            className="absolute right-2 top-2 rounded-full"
            disabled={removing}
            onClick={onRemove}
          >
            {removing ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            Kaldır
          </Button>
        </div>
      ) : null}
      <ImageDropzone busy={busy} onFiles={onFiles} />
    </div>
  );
}
