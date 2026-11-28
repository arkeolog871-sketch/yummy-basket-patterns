import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BellRing, PlusSquare, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { readOrCreateDeviceId } from "@/hooks/useFcmTokenBridge";
import { getMyPushRegistrationStatus, saveFcmToken } from "@/lib/push.functions";
import {
  hasNativeIosPush,
  requestNativeIosNotificationPermission,
  waitForNativeIosToken,
} from "@/lib/ios-native-push";
import { isNativeApp } from "@/lib/native-notify";
import { detectIosInstallKind } from "@/lib/iphone-install";
import { reportAppError } from "@/lib/errors.functions";

type StoredStatus = "registered" | "declined" | "home-screen-hint-shown";
type StoredState = { status: StoredStatus; at: number };

const STATE_KEY = (userId: string) => `silvan.push-prompt.v2.${userId}`;
/**
 * "Reddedildi"/"ana ekrana ekle ipucu gösterildi" durumları SONSUZA KADAR
 * sessiz kalmaz: kullanıcı fikrini Ayarlar'dan değiştirmiş ya da siteyi artık
 * ana ekrana eklemiş olabilir, bunu asla öğrenemeyiz. Bu süre sonunda bir kez
 * daha sorulur. "registered" bu kurala tabi değil — kalıcı.
 */
const RETRY_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

function readState(userId: string): StoredState | null {
  try {
    const raw = window.localStorage.getItem(STATE_KEY(userId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      "status" in parsed &&
      "at" in parsed &&
      typeof (parsed as StoredState).at === "number"
    ) {
      return parsed as StoredState;
    }
    return null;
  } catch {
    return null;
  }
}

function writeState(userId: string, status: StoredStatus) {
  try {
    window.localStorage.setItem(STATE_KEY(userId), JSON.stringify({ status, at: Date.now() }));
  } catch {
    /* yok say */
  }
}

/**
 * Hesabında hiç kayıtlı bildirim cihazı olmayan HER girişli kullanıcıya
 * (müşteri ya da işletme), girişten sonra bir kez "anlık bildirimlere izin
 * ver" isteği gösterir. Kabul edilince telefon hemen kaydedilir.
 *
 * YAŞANDI (iOS): Apple'ın sistem izni uygulama açılır açılmaz, hiçbir
 * açıklama olmadan isteniyordu ve bildirim "anahtarı" yalnızca bellekte
 * tutuluyordu. Bellek her soğuk açılışta sıfırlandığı için, bu ekrandaki
 * "İzin ver" her seferinde Apple'dan anahtarı yeniden istemek zorunda
 * kalıyordu — bu gerçek bir ağ gecikmesi. Erken basılırsa anahtar gelmeden
 * istek düşüyor, "bir daha sorma" hiç işaretlenmediği için bir dahaki girişte
 * AYNI yarış tekrarlanıyordu: "izin verdim ama sürekli soruyor" şikâyeti.
 * Ayrıca Safari'de (uygulama kurulmadan) bildirim Apple tarafından TEKNİK
 * OLARAK imkânsız (yalnızca ana ekrana eklenmiş sitelerde çalışıyor); eski
 * kod bunu hiç kontrol etmeden yine de sorup duruyordu.
 *
 * Artık: (1) Apple'ın izni yalnızca kullanıcı burada "İzin ver"e basınca
 * isteniyor (soft-ask) — uygulama açılışında değil; (2) anahtar native
 * tarafta kalıcı saklanıyor, bir sonraki açılışta Apple'dan beklemeden
 * kullanılıyor; (3) Safari'den (ana ekrana eklenmeden) gelenlere imkânsız bir
 * izni sormak yerine "ana ekrana ekle" adımları gösteriliyor; (4) red/ipucu
 * durumları kalıcı değil, 30 günde bir tekrar denenir; (5) başarısızlıklar
 * artık Sistem Hataları'na da düşüyor.
 */
export function PushPermissionPrompt() {
  const { user } = useAuth();
  const checkStatus = useServerFn(getMyPushRegistrationStatus);
  const saveToken = useServerFn(saveFcmToken);
  const reportError = useServerFn(reportAppError);
  const web = usePushNotifications();
  const [open, setOpen] = useState(false);
  const [showHomeScreenGuide, setShowHomeScreenGuide] = useState(false);
  const [isBusiness, setIsBusiness] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setOpen(false);
      return;
    }
    const saved = readState(user.id);
    if (saved?.status === "registered") return;
    if (saved && Date.now() - saved.at < RETRY_COOLDOWN_MS) return;

    // Safari'de (ana ekrana eklenmeden) bildirim Apple tarafından teknik
    // olarak imkânsız — sunucuya sormaya gerek yok, doğrudan "ana ekrana
    // ekle" rehberi gösterilir.
    if (!isNativeApp() && detectIosInstallKind() === "safari") {
      setShowHomeScreenGuide(true);
      setOpen(true);
      return;
    }

    // Tarayıcı teknik olarak desteklemiyorsa (eski tarayıcı, VAPID
    // yapılandırılmamış vb.) hiçbir şey yapılamaz — sormanın anlamı yok ve
    // kullanıcıya tepkisiz/yanıtsız bir pencere bırakmamak için hiç
    // açılmıyor. "checking"/"loading" henüz sonuçlanmadıysa bir sonraki
    // render'da (web.status bağımlılığı sayesinde) yeniden denenir.
    if (!isNativeApp()) {
      if (web.status === "checking" || web.status === "loading") return;
      if (web.status === "unsupported" || web.status === "unconfigured") return;
    }

    let cancelled = false;
    // Native köprünün jetonu kendiliğinden kaydetmesine birkaç saniye tanınır.
    const timer = setTimeout(() => {
      void checkStatus()
        .then((status) => {
          if (cancelled) return;
          if (status.hasDevice) {
            writeState(user.id, "registered");
            return;
          }
          setIsBusiness(status.isBusiness);
          setOpen(true);
        })
        .catch(() => {});
    }, 4000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [user, checkStatus, web.status]);

  if (!open || !user) return null;

  const finish = (status: StoredStatus) => {
    writeState(user.id, status);
    setOpen(false);
  };

  const allowNativeIos = async () => {
    const granted = await requestNativeIosNotificationPermission();
    if (!granted) {
      finish("declined");
      return;
    }
    const token = await waitForNativeIosToken();
    if (!token) {
      // İzin verildi ama anahtar bu ekranın beklediği sürede gelmedi.
      // Arka plandaki daha uzun soluklu deneme (useFcmTokenBridge, 45sn'ye
      // kadar) yakalayıp sessizce kaydedebilir; burada yalnızca kaydı
      // bırakıyoruz, 30 gün sonra hâlâ kayıtsızsa tekrar sorulur.
      void reportError({
        data: {
          message: "[push-prompt] iOS izin verildi ama anahtar zaman aşımına uğradı",
          path: "push-permission-prompt",
        },
      }).catch(() => undefined);
      finish("declined");
      return;
    }
    const deviceId = readOrCreateDeviceId();
    await saveToken({ data: { token, ...(deviceId ? { deviceId } : {}) } });
    finish("registered");
  };

  const allow = async () => {
    setBusy(true);
    setMessage(null);
    try {
      if (hasNativeIosPush()) {
        await allowNativeIos();
        return;
      }
      if (isNativeApp()) {
        const pending = (window as Window & { __fcmTokenPending?: string | null })
          .__fcmTokenPending;
        if (pending) {
          const deviceId = readOrCreateDeviceId();
          await saveToken({ data: { token: pending, ...(deviceId ? { deviceId } : {}) } });
          finish("registered");
          return;
        }
        setMessage(
          "Telefon henüz bildirim kimliği vermedi. Uygulamayı kapatıp açın; istek yeniden gelir.",
        );
        return;
      }
      await web.enable();
    } catch (error) {
      // YAŞANDI: bu hata hiç kaydedilmiyordu; neden başarısız olduğunu
      // (ör. aynı cihazda önceki hesabın abonelik satırı) geriye dönük
      // teşhis etmenin yolu yoktu.
      void reportError({
        data: {
          message: `[push-prompt] izin kaydı başarısız: ${
            error instanceof Error ? error.message : String(error)
          }`.slice(0, 1_000),
          path: "push-permission-prompt",
        },
      }).catch(() => undefined);
      setMessage("Kayıt şu anda yapılamadı. Lütfen tekrar deneyin.");
    } finally {
      setBusy(false);
    }
  };

  // Tarayıcı izni sonucu
  if (!isNativeApp() && web.status === "enabled" && open) {
    queueMicrotask(() => finish("registered"));
  }

  const webBlocked = !isNativeApp() && web.status === "denied";

  if (showHomeScreenGuide) {
    return (
      <div
        role="dialog"
        aria-labelledby="push-prompt-title"
        className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-lg"
      >
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <BellRing className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p id="push-prompt-title" className="font-display text-sm font-semibold">
              Bildirim için önce ana ekrana ekleyin
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              iPhone'da Safari'den anlık bildirim gönderilemiyor — Apple bunu yalnızca ana ekrana
              eklenmiş uygulamalarda açıyor.
            </p>
            <ol className="mt-2 space-y-1 text-xs text-muted-foreground">
              <li className="flex items-center gap-1.5">
                <Share2 className="size-3.5 shrink-0" /> Alttaki Paylaş düğmesine dokunun
              </li>
              <li className="flex items-center gap-1.5">
                <PlusSquare className="size-3.5 shrink-0" /> "Ana Ekrana Ekle"yi seçin
              </li>
            </ol>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                className="h-10 rounded-full px-5"
                onClick={() => finish("home-screen-hint-shown")}
              >
                Anladım
              </Button>
            </div>
          </div>
          <button
            type="button"
            aria-label="Kapat"
            className="rounded-full p-1 text-muted-foreground"
            onClick={() => finish("home-screen-hint-shown")}
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-labelledby="push-prompt-title"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-lg"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <BellRing className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p id="push-prompt-title" className="font-display text-sm font-semibold">
            {isBusiness
              ? "Siparişleri telefonunuzda anında görün"
              : "Sipariş durumunuzu anında öğrenin"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {isBusiness
              ? "Bu telefon bildirim için kayıtlı değil. İzin verirseniz yeni sipariş ve randevular uygulama kapalıyken de telefonunuza gelir."
              : "Bu telefon bildirim için kayıtlı değil. İzin verirseniz siparişiniz hazırlanırken ve yola çıktığında uygulama kapalıyken de telefonunuza haber gelir."}
          </p>
          {webBlocked ? (
            <p className="mt-2 text-xs text-destructive">
              Bildirim izni tarayıcı ayarlarından engellenmiş; oradan açmanız gerekiyor.
            </p>
          ) : null}
          {message ? <p className="mt-2 text-xs text-destructive">{message}</p> : null}
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              className="h-10 rounded-full px-5"
              disabled={busy || webBlocked}
              onClick={() => void allow()}
            >
              {busy ? "Kaydediliyor…" : "İzin ver"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-10 rounded-full"
              onClick={() => finish("declined")}
            >
              Daha sonra
            </Button>
          </div>
        </div>
        <button
          type="button"
          aria-label="Kapat"
          className="rounded-full p-1 text-muted-foreground"
          onClick={() => finish("declined")}
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
