import { Bell, BellOff, BellRing } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Button } from "@/components/ui/button";

/** Uygulama/sekme kapalıyken de bildirim alabilmek için push aboneliğini açar/kapatır. */
export function PushNotificationButton({ className }: { className?: string }) {
  const { status, enable, disable } = usePushNotifications();

  if (status === "unsupported") {
    return (
      <p className={`text-xs text-muted-foreground ${className ?? ""}`}>
        Bu tarayıcı anlık bildirimleri desteklemiyor.
      </p>
    );
  }

  if (status === "unconfigured") {
    return null;
  }

  if (status === "enabled") {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={`rounded-full ${className ?? ""}`}
        onClick={() => void disable()}
      >
        <BellRing className="size-4" /> Anlık bildirimler açık
      </Button>
    );
  }

  if (status === "denied") {
    return (
      <p className={`flex items-center gap-1.5 text-xs text-muted-foreground ${className ?? ""}`}>
        <BellOff className="size-3.5" /> Bildirim izni tarayıcı ayarlarından engellenmiş.
      </p>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={`rounded-full ${className ?? ""}`}
      disabled={status === "loading" || status === "checking"}
      onClick={() => void enable()}
    >
      <Bell className="size-4" />
      {status === "loading" ? "Açılıyor…" : "Anlık bildirimleri aç"}
    </Button>
  );
}
