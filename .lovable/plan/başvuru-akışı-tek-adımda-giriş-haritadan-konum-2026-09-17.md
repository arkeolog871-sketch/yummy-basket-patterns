# Başvuru akışı: tek adımda giriş + haritadan konum

## 1) Apple / e-posta girişinden sonra doğrudan forma dönüş

Şu anda ne oluyor:

1. Kullanıcı başvuru sayfasında "Apple ile devam et"e basıyor.
2. Apple girişi bitince kullanıcı **giriş sayfasına** dönüyor.
3. Giriş sayfası, girişten sonra kullanıcıyı yalnızca ödeme sayfasına geri
   götürebiliyor; diğer her durumda **ana sayfaya** atıyor.
4. Sonuç: kişi giriş yapmış oluyor ama başvuru formunu göremiyor. "Kahve Diyarı"nda
   yaşanan tam olarak bu.

Yapılacak:

- Kullanıcı başvuru sayfasından girişe başladığında "bu kişi başvuru formuna dönmek
  istiyor" bilgisi tarayıcıda kısa süreli saklanacak.
- Giriş tamamlanınca kullanıcı ana sayfa yerine doğrudan başvuru formuna götürülecek;
  bu geri dönüş yalnızca uygulamanın kendi sayfalarına izin verecek şekilde sınırlı olacak.
- Arada ikinci bir doğrulama ekranı görünmeyecek: giriş biter, form açılır. iPhone
  uygulamasında giriş uygulama içinde bittiği için form anında açılacak.
- "Doğrulandıktan sonra bu sayfaya geri dönün" gibi geçersiz kalan yazılar
  "Giriş tamamlanınca form otomatik açılır" şeklinde güncellenecek.
- Ödeme sayfasından yapılan girişlerin mevcut davranışı bozulmayacak; başvuru
  gönderiminde sunucu tarafındaki doğrulanmış hesap şartı aynen kalacak.

## 2) Google Cloud harita anahtarının bağlanması

Uygulamada haritalar şu anda kurucu panelindeki "Haritalar" alanına girilen anahtarla
çalışıyor; anahtar yoksa veya reddedilirse açık kaynak harita yedeğine düşüyor.

Yapılacak:

- Google Maps bağlantısı, **senin kendi Google Cloud anahtarınla** kurulacak
  (sohbette bir bağlanma kartı açılacak; orada "Yeni bağlantı" → "Kendi
  bilgilerimi kullan" seçilecek).
- Bağlantı kurulduktan sonra harita gerçekten yükleniyor mu, anahtar reddediliyor mu
  kontrol edilecek; hata varsa hangi ayarın düzeltilmesi gerektiği sana net yazılacak.
- Anahtarın çalışması için Google Cloud tarafında gerekenler: Maps JavaScript API
  açık olmalı, faturalandırma etkin olmalı ve anahtarın izinli adres listesinde
  şunlar bulunmalı:
  - `https://uygulamamcebimde.online/*`
  - `https://*.uygulamamcebimde.online/*`
  - `https://uygulamamcebimde.lovable.app/*`
  - `https://*.lovable.app/*` (önizleme için)
- Adres arama/otomatik tamamlama gibi ek servisler bu adımda eklenmeyecek; ihtiyaç
  olursa ayrıca konuşulur (ücretli kullanım).

## 3) Başvuru formunda haritadan konum işaretleme

Şu anda formda "Enlem" ve "Boylam" iki ayrı sayı alanı var; işletme sahibinin bu
değerleri kendi bulması gerekiyor.

Yapılacak:

- İki sayı alanının yerine forma bir harita gelecek. İşletme sahibi haritada kendi
  yerine dokunarak ya da işaretçiyi sürükleyerek konumunu belirleyecek.
- "Konumumu kullan" düğmesi olacak: telefonun konumu haritayı doğrudan işletmenin
  bulunduğu yere getirecek.
- Haritanın başlangıç noktası, girilen şehir/ilçe bilgisine göre ayarlanacak;
  bilgi yoksa hizmet bölgesinin merkezinden başlayacak.
- İşaretlenen noktanın koordinatları arka planda otomatik kaydedilecek; kullanıcı
  hiç sayı girmeyecek. Konum işaretlenmeden başvuru gönderilemeyecek ve "Haritada
  işletmenizin yerini işaretleyin" uyarısı görünecek.
- Kurucu paneli, işletme sayfası ve yol tarifi bu koordinatları bugün olduğu gibi
  kullanmaya devam edecek; veri yapısı değişmiyor.
- Harita anahtarı çalışmadığı durumda mevcut açık kaynak harita yedeği ile işaretleme
  yine yapılabilecek, yani başvuru hiçbir koşulda kilitlenmeyecek.

## Teknik ayrıntı

- `src/routes/auth.tsx`: giriş sonrası yönlendirme tek istisna (`/odeme`) yerine güvenli
  iç yol beyaz listesinden okunacak; `sessionStorage`'daki bekleyen niyet de bu listeye
  göre doğrulanıp kullanılacak ve silinecek. Yeni yardımcı
  `src/lib/post-login-intent.ts` (yaz/oku/sil + yol doğrulama) ve birim testi.
- `src/routes/isletme-basvuru.tsx`: OAuth/OTP başlamadan önce niyet kaydı; oturum
  görüldüğünde ara ekran atlanıp forma geçiş; metin güncellemeleri.
- Harita bağlantısı: `standard_connectors--connect` (`google_maps`,
  `prefer_new_connection: true`). Tarayıcı tarafı anahtar `VITE_LOVABLE_CONNECTOR_*`
  üzerinden, mevcut `maps_config` anahtarı yedek kaynak olarak korunacak
  (`src/lib/maps.functions.ts` / `google-maps-loader.ts` çözümleme sırası).
- Yeni bileşen `src/components/business/LocationPicker.tsx`: Google Maps'te
  sürüklenebilir işaretçi + tıklama, Leaflet yedeğinde aynı davranış; `value`/`onChange`
  ile `{ lat, lng }`. Formda `latitude`/`longitude` state'i bu bileşenden beslenecek,
  gönderim öncesi zorunluluk kontrolü eklenecek. Sunucu şeması (`business-applications.functions.ts`)
  değişmiyor.
- Doğrulama: `bunx tsgo --noEmit`, ilgili birim testleri, build ve `/isletme-basvuru`
  önizleme kontrolü.
