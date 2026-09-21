# Yapay zekâ desteği — uygulama planı

Seçtiğin beş özelliği, birbirini besleyecek şekilde dört aşamada kuruyorum. Ek anahtar gerekmiyor; yapay zekâ Lovable AI üzerinden çalışır ve kullanım kredilerden düşer. Şimdilik kullanıcı limiti koymuyorum (istediğin an eklenebilir).

## Aşama 1 — Satıcı: menü fotoğrafından ürün çıkarma

- Satıcı panelindeki toplu ürün ekleme bölümüne "Fotoğraftan ürün çıkar" adımı eklenir.
- Satıcı menü fotoğrafı (veya birkaç fotoğraf) yükler; yapay zekâ ürün adı, fiyat, kategori ve kısa açıklama listesi çıkarır.
- Liste düzenlenebilir tablo olarak gösterilir: satıcı fiyatı düzeltir, istemediğini işaretlemez, "Onayla ve kaydet" der.
- Kaydetme mevcut toplu ekleme akışını kullanır; yetki ve bölge kontrolleri aynen geçerli.

## Aşama 2 — Müşteri: akıllı arama

- Ana sayfadaki arama kutusu serbest cümleleri anlar: "ucuz kahvaltı", "gece açık market", "çocukla gidilir yer".
- Yapay zekâ cümleyi kategori + anahtar kelime + filtrelere çevirir; sonuç sıralaması mevcut işletme/ürün verisinden gelir, yani uydurma sonuç çıkmaz.
- Yapay zekâ cevap vermezse arama eskisi gibi normal metin aramasına döner (hiçbir zaman boş ekran olmaz).

## Aşama 3 — Müşteri: sipariş asistanı (sohbet + sipariş verme)

- Sağ alt köşede sohbet butonu; sayfa değişse de sohbet korunur.
- Asistan gerçek veriye bakarak çalışır: işletme arama, menü listeleme, çalışma saati / teslimat ücreti / minimum sepet bilgisi.
- **Sipariş verme**: asistan ürünleri sepete ekler, adres ve ödeme yöntemini sorar, ardından siparişi **onay ekranında** gösterir. Sipariş ancak kullanıcı "Siparişi onayla" butonuna basınca oluşur — asistan kendi başına sipariş kesinleştirmez.
- Sipariş oluşturma yine mevcut sipariş fonksiyonlarından geçer: stok, kapanmış işletme, bölge dışı adres kontrolleri aynen uygulanır.
- Geçmiş: tek sohbet, cihazda saklanır (kullanıcı "Yeni sohbet" ile temizler). İstersen sonradan hesaba bağlı geçmişe çeviririz.

## Aşama 4 — İçerik: ürün açıklaması ve görseli

- Satıcı ve kurucu panelinde ürün satırında "Açıklama üret" ve "Görsel üret" butonları.
- Açıklama: ürün adı + kategoriden kısa, iştah açıcı Türkçe metin; satıcı düzenleyip kaydeder.
- Görsel: görseli olmayan ürünler için üretilir, ön izleme onaylanınca ürüne eklenir.
- Toplu mod: "Açıklaması olmayan tüm ürünler için üret" (sırayla, ilerleme göstergesiyle).

## Teknik özet

- Model: `openai/gpt-6-astra` (metin), varsayılan görsel modeli (görsel üretimi). Tüm çağrılar sunucu tarafında; anahtar tarayıcıya hiç çıkmaz.
- Sohbet akışı: `src/routes/api/chat.ts` (streaming) + AI Elements tabanlı arayüz; diğer özellikler `createServerFn` ile (`src/lib/ai-*.functions.ts`).
- Asistanın yetenekleri araç (tool) olarak tanımlanır: `searchBusinesses`, `getMenu`, `addToCart`, `createOrder` — hepsi mevcut server fonksiyonlarını ve RLS'i kullanır, doğrudan veritabanına yazmaz.
- Menü fotoğrafı okuma ve görsel üretimi için yeni bir tablo gerekmiyor; sadece geçici yükleme + mevcut `menu_items` yazma yolu.
- Hata durumları `toPublicErrorMessage` üzerinden Türkçe gösterilir; kredi yetersizliği/yoğunluk durumunda asistan "şu an yanıt veremiyorum" der, sipariş akışı normal ekranlardan devam eder.
- Testler: araç şemaları ve sipariş onayı için birim testleri, sohbet akışı için uçtan uca bir senaryo.

## Sıra ve onay

Önerim: Aşama 1 → 2 → 3 → 4. En hızlı fayda 1 ve 2'de, en çok iş 3'te (sipariş verme yetkisi olduğu için dikkatli test gerekir).

Onaylarsan Aşama 1 ile başlıyorum.
