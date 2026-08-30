import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import {
  founderSendNotification,
  listFounderNotificationBroadcasts,
  previewFounderNotificationAudience,
} from "@/lib/notifications.functions";
import { toPublicErrorMessage } from "@/lib/public-error";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Target = "all" | "all_vendors" | "all_customers";

const AUDIENCE_LABELS: Record<Target, string> = {
  all: "Herkes",
  all_customers: "Sadece Kullanıcılar",
  all_vendors: "Sadece İşletmeler",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Bekliyor",
  sending: "Gönderiliyor",
  completed: "Tamamlandı",
  failed: "Başarısız",
};

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `idemp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function NotificationsPanel() {
  const queryClient = useQueryClient();
  const send = useServerFn(founderSendNotification);
  const preview = useServerFn(previewFounderNotificationAudience);
  const listHistory = useServerFn(listFounderNotificationBroadcasts);

  const [target, setTarget] = useState<Target>("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const idempotencyKeyRef = useRef(newIdempotencyKey());
  const sendingLockRef = useRef(false);

  const history = useQuery({
    queryKey: ["founder-notification-broadcasts"],
    queryFn: () => listHistory(),
    retry: false,
  });

  const audienceQuery = useQuery({
    queryKey: ["founder-notification-audience", target],
    queryFn: () => preview({ data: { target } }),
    retry: false,
  });

  const targetCount = audienceQuery.data?.targetCount ?? 0;
  const tokenCount = audienceQuery.data?.tokenCount ?? 0;

  const canSubmit = Boolean(title.trim() && body.trim()) && !mutation.isPending;

  const mutation = useMutation({
    mutationFn: () =>
      send({
        data: {
          target,
          title: title.trim(),
          body: body.trim(),
          idempotencyKey: idempotencyKeyRef.current,
        },
      }),
    onSuccess: (result) => {
      sendingLockRef.current = false;
      setConfirmOpen(false);
      if (result.duplicate) {
        toast.message("Bu bildirim zaten gönderilmişti.", {
          description: `Hedeflenen: ${result.targetCount} · Başarılı: ${result.successCount} · Başarısız: ${result.failureCount}`,
        });
      } else {
        toast.success("Bildirim gönderildi.", {
          description: `Hedeflenen: ${result.targetCount} · Başarılı: ${result.successCount} · Başarısız: ${result.failureCount}`,
        });
        if (!result.pushConfigured) {
          toast.message("Push yapılandırması eksik", {
            description:
              "FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY tanımlı değil. Uygulama içi kayıt oluştu; cihaz push'u atlandı.",
          });
        }
        setTitle("");
        setBody("");
        idempotencyKeyRef.current = newIdempotencyKey();
      }
      void queryClient.invalidateQueries({ queryKey: ["founder-notification-broadcasts"] });
      void queryClient.invalidateQueries({ queryKey: ["founder-notification-audience", target] });
    },
    onError: (error: Error) => {
      sendingLockRef.current = false;
      toast.error(toPublicErrorMessage(error));
    },
  });

  useEffect(() => {
    // Hedef değişince yeni gönderim için yeni anahtar.
    idempotencyKeyRef.current = newIdempotencyKey();
  }, [target]);

  const previewLines = useMemo(
    () => [
      `Hedef: ${AUDIENCE_LABELS[target]}`,
      `Tahmini alıcı: ${targetCount.toLocaleString("tr-TR")}`,
      `Kayıtlı cihaz token: ${tokenCount.toLocaleString("tr-TR")}`,
      `Başlık: ${title.trim() || "—"}`,
      `Mesaj: ${body.trim() || "—"}`,
    ],
    [target, targetCount, tokenCount, title, body],
  );

  function openConfirm() {
    if (!title.trim() || !body.trim() || mutation.isPending || sendingLockRef.current) return;
    setConfirmOpen(true);
  }

  function confirmSend() {
    if (mutation.isPending || sendingLockRef.current) return;
    sendingLockRef.current = true;
    mutation.mutate();
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Bildirim Gönder</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Mesaj hem bildirim merkezine kaydedilir hem de kayıtlı cihazlara FCM push olarak iletilir.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Hedef kitle</Label>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Hedef kitle">
          {(
            [
              ["all", "Herkes"],
              ["all_customers", "Sadece Kullanıcılar"],
              ["all_vendors", "Sadece İşletmeler"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              type="button"
              size="sm"
              role="radio"
              aria-checked={target === value}
              variant={target === value ? "default" : "outline"}
              onClick={() => setTarget(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card p-4 text-sm">
        {previewLines.map((line) => (
          <p key={line} className="leading-6 text-muted-foreground">
            {line}
          </p>
        ))}
        {audienceQuery.isError ? (
          <p className="mt-2 text-destructive">Alıcı sayısı yüklenemedi.</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="notify-title">Başlık</Label>
        <Input
          id="notify-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={120}
          placeholder="Bildirim başlığı"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notify-body">Mesaj</Label>
        <Textarea
          id="notify-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={500}
          rows={4}
          placeholder="Bildirim içeriği"
        />
      </div>

      <Button
        type="button"
        disabled={!canSubmit || mutation.isPending || audienceQuery.isLoading}
        onClick={openConfirm}
      >
        <Send className="mr-2 size-4" />
        {mutation.isPending ? "Gönderiliyor…" : "Gönder"}
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Toplu bildirim onayı</AlertDialogTitle>
            <AlertDialogDescription>
              Bu bildirim {targetCount.toLocaleString("tr-TR")} alıcıya gönderilecek (
              {AUDIENCE_LABELS[target]}). Devam etmek istiyor musunuz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              disabled={mutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                confirmSend();
              }}
            >
              {mutation.isPending ? "Gönderiliyor…" : "Evet, gönder"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-3">
        <h3 className="text-base font-semibold">Gönderim geçmişi</h3>
        {history.isLoading ? (
          <p className="text-sm text-muted-foreground">Yükleniyor…</p>
        ) : history.isError ? (
          <p className="text-sm text-muted-foreground">Geçmiş yüklenemedi.</p>
        ) : (history.data?.items ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz toplu bildirim yok.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border/70">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Başlık</TableHead>
                  <TableHead>Hedef</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Alıcı</TableHead>
                  <TableHead>Başarılı</TableHead>
                  <TableHead>Başarısız</TableHead>
                  <TableHead>Zaman</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(history.data?.items ?? []).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="max-w-[220px]">
                      <p className="truncate font-medium">{row.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{row.body}</p>
                    </TableCell>
                    <TableCell>{AUDIENCE_LABELS[row.audience as Target] ?? row.audience}</TableCell>
                    <TableCell>{STATUS_LABELS[row.status] ?? row.status}</TableCell>
                    <TableCell>{row.target_count}</TableCell>
                    <TableCell>{row.success_count}</TableCell>
                    <TableCell>{row.failure_count}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(row.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
