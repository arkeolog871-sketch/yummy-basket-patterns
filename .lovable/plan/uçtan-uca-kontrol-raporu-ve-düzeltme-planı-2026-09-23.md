# Uçtan uca kontrol raporu ve düzeltme planı

Tarih: 23 Eylül 2026. Aşağıdaki her madde bu turda ölçülerek doğrulandı; tahmin yok.

## Genel durum: sağlıklı

- Otomatik testler: 74 dosya, **720 test, tamamı geçti**.
- Kod tipi kontrolü: **hatasız**.
- Derleme kaydında hata yok; önizlemede çalışma zamanı hatası yok.
- Sayfa denetimi (18 sayfa): ana sayfa, işletmeler, giriş, sepet, ödeme, hesabım,
  işletme başvurusu, kurucu, işletme paneli, yasal metinler, indirme sayfaları
  **hepsi açılıyor**. Siparişlerim ve adreslerim giriş yapılmadığında beklendiği
  gibi yönlendiriyor.
- Güvenlik başlıkları (içerik politikası, HSTS, çerçeve koruması, yönlendirici
  politikası, izin politikası) canlı yanıtta **yerinde**.
- Sızma denemeleri (gizli dosya, dizin atlama, medya adresi kurcalama) reddediliyor;
  dış kaynaklara açık paylaşım (CORS) yok.
- Veri: 7 işletme (hepsi aktif), 294 ürün, 20 sipariş (son 7 günde 1), 31 hesap,
  3 işletme başvurusu, 15 yetki kaydı. Son 14 günde yalnız 10 kullanıcı hatası
  kaydı var, hiçbiri sipariş veya ödeme akışında değil.

## Bulgular (önem sırasına göre)

1. **Biçim denetimi kirli.** Kod kalite aracı 1832 uyarı veriyor; 1812'si yalnız
   satır düzeni/boşluk. Gerçek uyarı sadece 20: 14 modül düzeni bilgisi,
   1 eksik bağımlılık uyarısı, 2 `let` yerine `const`, 3 gevşek tip.
   İşleyişi etkilemiyor ama denetim çıktısını okunamaz yapıyor.
2. **İki sayfada paylaşım bilgisi yok.** `siparislerim` ve `adreslerim` sayfalarının
   kendi başlık/açıklama tanımı yok; kök tanım devralınıyor.
3. **Veritabanı denetçisi 25 not veriyor.** 6 tablo kural yazılmadan kilitli
   (bunlar yalnız sunucunun eriştiği tablolar — kasıtlı ve doğru), 1 fonksiyonda
   arama yolu sabitlenmemiş, 1 eklenti genel şemada, 17 fonksiyon giriş yapmış
   veya anonim kullanıcı tarafından çağrılabilir durumda. Son grup gözden
   geçirilmeli: gerçekten dışarıdan çağrılması gerekenler kalsın, gerekmeyenlerin
   çağrı yetkisi kaldırılsın.
4. **Güvenlik hızlı testinde 1 uyumsuzluk.** `/.env` isteği geliştirme sunucusunda
   403, test 404 bekliyor. Canlıda 404 dönüyor; test beklentisi güncellenmeli.
5. **Yapay zekâ düğmeleri kapalı** (istediğiniz gibi). Altyapı yerinde; gerçek
   zamanlı ses için OpenAI hesabında bakiye gerekiyor — bakiye yokken sistem
   otomatik olarak eski kayıt-yanıt moduna düşüyor.
6. **Açık kalan iki yol haritası maddesi:** Apple/e-posta girişinden sonra
   doğrudan başvuru formuna dönüş, ve başvuru formunda koordinat yerine haritadan
   konum işaretleme.

## Öneri: bu turda yapılacaklar

1. Biçimlendirmeyi tek seferde düzelt (`prettier` otomatik düzeltme) ve kalan
   20 gerçek uyarıyı elden geçir.
2. `siparislerim` ve `adreslerim` sayfalarına kendi başlık ve açıklamasını ekle.
3. Veritabanı fonksiyon yetkilerini tek tek gözden geçir; dışarıdan çağrılması
   gerekmeyenlerin çağrı yetkisini kaldıran bir göç dosyası yaz. Sipariş, giriş,
   yetki ve bildirim akışlarını bozmayacak şekilde, her fonksiyonun kim tarafından
   kullanıldığı koddan doğrulanarak.
4. Güvenlik hızlı testinin `/.env` beklentisini 403/404 kabul edecek şekilde
   güncelle.
5. Arama yolu sabitlenmemiş fonksiyonu düzelt.

Yol haritasındaki iki açık madde (Apple girişi dönüşü, haritadan konum) ayrı bir
iş; isterseniz bunları da aynı turda ele alırım.

## Teknik notlar

- Silinmeyecekler kuralına uyuldu: hiçbir dosya silinmedi, yalnız okuma yapıldı.
- Kural yazılmadan kilitli tablolar: `email_otp_guard`, `oauth_code_relay`,
  `product_catalog`, `product_imports`, `request_rate_limit`,
  `restaurant_sync_tokens` — yalnız servis anahtarıyla erişilen tablolar,
  politika eklenmemesi doğru davranış.
- Hata kayıtlarındaki tek tekrarlayan tür React 418/hidrasyon; son kayıt
  21 Eylül, düzeltmeden önceki dağıtımdan.
