# Silvan Cebimde — Hukuki Uyum ve Sorumluluk Mimarisi (aşamalı plan)

İstek 29 başlık içeriyor ve veritabanı, sipariş, ödeme, işletme paneli, kurucu paneli ve yasal sayfaların hepsine dokunuyor. Çalışan sipariş, kod ile giriş, bildirim ve sepet akışlarını bozmamak için iş 6 aşamaya bölündü. Her aşama tek başına yayına alınabilir. Her aşamanın sonunda tip kontrolü, testler, derleme ve güvenlik denetimi çalıştırılır.

Temel ilke: Platformun sorumluluğunu sözleşmeyle "sıfırlayan" hiçbir hüküm yazılmaz. Metinlerde "mevzuattan doğan zorunlu yükümlülükler saklı kalmak kaydıyla" ifadesi kullanılır. Bilinmeyen şirket bilgileri (MERSİS, vergi no, KEP, adres) uydurulmaz. Bu bilgiler eksikse ilgili belge "yayına hazır değil" olarak işaretlenir.

## Aşama 1 — Denetim raporu ve platform kimliği
- Kodu inceleyip veri envanteri çıkarmak: hangi veri nerede toplanıyor, hangi dış hizmete gidiyor. Dış hizmetler: veritabanı ve barındırma, e-posta, Google Maps / OSM, Firebase bildirim, OpenAI (AI kapalı ama altyapı duruyor).
- Yurt dışı aktarım durumu her hizmet için varsayılan olarak "beklemede" başlar. Kurucu paneli bunu işaretleyene kadar da öyle kalır.
- `platform_identity` tablosu: ticari unvan, marka, MERSİS, vergi dairesi ve no, adres, telefon, e-posta, KEP, KVKK başvuru adresi, yetkili kişi.
- Kurucu panelinde yeni sekme: "Hukuk ve Uyum › Platform Kimliği".

## Aşama 2 — Sürümlü Hukuki Belge Merkezi
- `legal_documents` tablosu: tür, sürüm, başlık, içerik, yürürlük tarihi, durum (taslak/yayında/arşiv), oluşturan, yayınlayan.
- `legal_acceptances` tablosu: kullanıcı, belge, sürüm, zaman, kabul türü (sözleşme kabulü / aydınlatma okundu / açık rıza / pazarlama izni), IP özeti (düz IP değil), bağlam. Yalnız ekleme yapılabilir.
- 16 belge, gerçek iş modeline göre yeniden yazılır (aracı hizmet sağlayıcı, kapıda ödeme, yerel işletmeler). Bugünkü `legal.ts` metinlerindeki tüketiciyi zayıflatan ifadeler kaldırılır; örneğin "süre işletmeyle belirlenir".
- `/yasal` adresinde Yasal Merkez: belgelerin listesi. Her belgede sürüm, yürürlük tarihi, ilgili taraf, iletişim ve yazdırma düğmesi olur. Alt bilgideki bağlantılar korunur, sonuna "Tümü" eklenir.
- Kurucu paneli: taslak düzenleme ve yayınlama. Yayınlanan her sürüm denetim kaydına yazılır.

## Aşama 3 — Onay ayrımı, çerez ve ticari ileti
- Kod ekranındaki tek onay kutusu üçe ayrılır:
  - Kullanım Koşulları kabulü (zorunlu)
  - KVKK Aydınlatma bilgilendirmesi: "okudum, bilgi edindim"; açık rıza gibi sunulmaz
  - Pazarlama izni (isteğe bağlı, işaretsiz başlar)
- Mevcut onay kapısı sürüm bazlı çalışır hale gelir. Yeni sürüm yayınlanınca yeniden onay istenir. Eski hesaplar kilitlenmez; yalnız yeni sürümü onaylamaları istenir.
- `communication_consents`: kanal (SMS / e-posta / bildirim), durum, kaynak ve geçmiş. İYS alanları için yer ayrılır.
- Pazarlama gönderimi sunucuda bu kayda bakar ve izin yoksa engellenir. Sipariş bildirimleri hizmet iletisi olduğu için etkilenmez.
- Çerez tercih merkezi. Bugün yalnız zorunlu teknik depolama kullanılıyor; analitik/izleyici eklenmez. Tercih sürümlü olarak kaydedilir.

## Aşama 4 — İşletme doğrulama ve sözleşme
- `business_applications` ve `restaurants` için yeni alanlar: tüzel/gerçek kişi, unvan, vergi no, MERSİS (varsa), gıda kayıt/onay belgesi, belge yenileme tarihi, doğrulama durumu, ret/askı gerekçesi.
- `business_documents` tablosu: özel depolama alanında tutulur, kısa süreli imzalı bağlantıyla açılır.
- Zorunlu belgeler eksikse ya da süresi dolmuşsa işletme yayına alınamaz (veritabanı kuralıyla).
- İşletme panelinde güncel "Katılım ve Aracılık Sözleşmesi" sürümü onaylanmadan sipariş alma açılamaz.
- İşletme sayfasında müşteriye görünen satıcı kutusu: unvan, adres, telefon, vergi no, saatler, teslimat modeli ve ücretleri, "Satıcı bu işletmedir; platform aracıdır" açıklaması. Gizli yönetim bilgileri gösterilmez.

## Aşama 5 — Ödeme sepeti, sipariş kaydı, iptal/iade, komisyon
- Ödeme sayfasında gönder düğmesinden önce ön bilgilendirme: satıcı, platform, kalemler, KDV dahil toplam, teslimat ücreti, kapıda ödeme, cayma istisnası (çabuk bozulan gıda) ve şikâyet yolları.
- Düğme metni: "Siparişi onayla, ödeme yükümlülüğü doğar".
- Siparişe ön bilgilendirmenin anlık görüntüsü ve belge sürümleri eklenir. Müşteri sipariş sayfasında bunu açıp yazdırabilir.
- Sipariş fonksiyonu yalnız bu ek alanlarla genişletilir; stok ve eşzamanlılık mantığına dokunulmaz.
- `refund_requests`: sipariş, kalem, gerekçe, kanıt, durum, karar, taraf. Tam ve kısmi iade kayıt altına alınır. Para iadesi kapıda ödemede elden yapıldığı için kayıt amaçlıdır.
- `commission_rules` (sürümlü) ve `order_fee_lines`: hizmet kalemi bazında bedeller. İşletme panelinde aylık döküm. Bugün komisyon alınmıyorsa oranlar 0 ile başlar; oran uydurulmaz.
- Ödeme sağlayıcı soyutlaması: `payment_transactions` (sağlayıcı, işlem no, tutar, iade, uzlaşma, benzersiz anahtar) ve imza doğrulamalı, tekrar gönderimde çift işlem yapmayan webhook iskeleti. Gerçek sağlayıcı seçilene kadar yalnız "kapıda ödeme" aktif kalır. Kart verisi hiçbir yerde tutulmaz.

## Aşama 6 — Şikâyet, yorum, içerik, silme, ihlal, uyum merkezi
- `complaints` + `complaint_events`: açık → satıcı yanıtı → platform incelemesi → çözüldü / reddedildi / iade / üst merci. Süreler kurucu panelinden ayarlanır. Mesajlar yalnız taraflara gösterilir.
- Yorumlar: "doğrulanmış sipariş" etiketi (yalnız teslim edilmiş siparişe yorum), tekrar ve spam sınırı, raporlama (`content_reports`), işletme cevabı, gerekçeli kaldırma.
- Ürün ve kampanya içerik denetimi: yasaklı ifade listesi ve raporla/kaldır/askıya al işlemleri.
- Hesap silme güçlendirmesi: anonimleştirme, yasal saklama gerekçesi, silinen ve tutulan alanların kaydı, tamamlanma tarihi. Sipariş ve fatura kayıtları silinmez, anonimleştirilir.
- `security_incidents`: olay kaydı. Bildirim süreleri ayarlanabilir; kod içinde süre uydurulmaz.
- Denetim kaydı genişletilir: rol, öncesi/sonrası özeti, gerekçe, istek kimliği. Güncelleme ve silme veritabanında engellenir; parola ve kod zaten maskeleniyor.
- Kurucu panelinde "Hukuk ve Uyum Merkezi" 13 listeyle: eksik/süresi dolan belgeler, yayınlanmamış metinler, sözleşmeyi onaylamayan işletmeler, şikâyetler, riskli ürünler, iade oranı, ödeme sorunları, ihlaller, silme talepleri, ileti izinleri, KVKK başvuruları, bekleyen doğrulamalar.
- Toplu değişikliklerde (tüm işletmeler/ürünler) ikinci kurucu onayı.

## Teknik ayrıntılar
- Rol modeli: `app_role`'a `platform_operator` eklenmez; mevcut `founder` bu rolü karşılar. Mevcut `vendor` + `vendor_assignments` işletme yetkilisini karşılar. Kurye ve ödeme kuruluşu, siparişte `order_parties` satırı olarak tutulur (şimdilik yalnız işletme teslimatı ve kapıda ödeme).
- Her yeni tabloya yetki (GRANT) ve RLS eklenir. İşletme yalnız `is_vendor_of`, müşteri yalnız `auth.uid()` kapsamını görür; kurucu erişimi `has_role` ile verilir.
- Denetim ve onay tabloları yalnız ekleme yapılabilir (tetikleyiciyle engelleme).
- Testler (birim + E2E): A–S senaryoları. Canlı ödeme sağlayıcısı olmadığı için Q senaryosu sahte webhook ile yapılır; gerçek OTP e-postası gerektiren A senaryosu hazırlık ortamı testine bağlanır.

## Varsayımlar (düzeltin)
- Bugün komisyon alınmıyor, ödeme yalnız kapıda, kurye yok (teslimatı işletme yapıyor).
- Şirket bilgileri eksik; kurucu panelinden siz dolduracaksınız.
- Metinler taslaktır; yayından önce bir avukatın incelemesi gerekir. Sistem bunu "hukukçu onayı" işaretiyle takip eder.

## Rapor
Her aşama sonunda: değişen dosyalar, göçler, yeni tablolar, değişen akışlar, kalan şirket bilgileri, hukukçu kontrol noktaları, test sonuçları, bilinen riskler.
