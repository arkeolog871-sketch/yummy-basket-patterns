-- Aynı telefona iki bildirim düşüyordu.
--
-- FCM kayıt jetonu zamanla yenileniyor (uygulama verisi silinince, yeniden
-- kurulunca, yedekten dönünce ya da kendiliğinden). saveFcmToken yalnızca
-- `token` üzerinden upsert ettiği için yenilenen jeton YENİ bir satır
-- açıyor, eski satır hiç silinmiyordu. Eski jeton bir süre daha geçerli
-- kaldığından duyuru aynı telefona iki kez gidiyordu.
--
-- Kurulum başına sabit bir kimlik, "aynı cihazın yeni jetonu" ile "ikinci
-- cihaz"ı ayırt etmenin tek yolu. Kimlik tarayıcı tarafında (localStorage)
-- üretiliyor; native uygulama güncellemesi gerekmiyor.
--
-- Kolon bilerek NULL kabul ediyor: kimliği olmayan eski satırlar çalışmaya
-- devam etsin, cihaz o uygulamayı bir daha açtığında kimliğiyle birlikte
-- kendini yeniden kaydeder.
ALTER TABLE public.fcm_tokens ADD COLUMN IF NOT EXISTS device_id text;

-- Tekilliği kod tarafında (aynı cihazın eski jetonunu silerek) sağlıyoruz;
-- kısmi bir UNIQUE indeks ON CONFLICT ile eşleşmediği için (42P10) burada
-- yalnızca arama indeksi var.
CREATE INDEX IF NOT EXISTS fcm_tokens_user_device_idx
  ON public.fcm_tokens (user_id, device_id);
