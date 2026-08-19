# SofraKapımda — Yemek Sipariş Uygulaması Planı

## Marka ve his
- İsim: **SofraKapımda**
- Ton: sıcak, davetkar, iştah açıcı
- Renk yönü: krem zemin (`#fff8f0`), turuncu vurgu (`#ff8c42`), koyu metin (`#2d2d2d`), canlı kırmızı aksan (`#e63946`)

## Altyapı
1. Lovable Cloud aktif hale getirilecek (auth + PostgreSQL + storage).
2. Tasarım sistemi `src/styles.css` içinde tanımlanacak: warm palette, yuvarlak köşeler, yemek fotoğrafı odaklı kartlar.
3. Gerekli shadcn/ui bileşenleri eklenecek: button, card, badge, input, dialog, sheet, tabs, separator, sonner.

## Veritabanı şeması
- `profiles` — kullanıcı profilleri (Lovable Cloud auth ile bağlı).
- `addresses` — kullanıcı teslimat adresleri (başlık, adres, ilçe/il, varsayılan adres).
- `restaurants` — restoran bilgileri, kategori, puan, teslimat süresi, minimum sipariş, kapak fotoğrafı.
- `menu_categories` — restoran menü grupları.
- `menu_items` — yemekler, fiyat, açıklama, fotoğraf.
- `orders` — siparişler, durum, toplam tutar, adres, ödeme durumu.
- `order_items` — sipariş kalemleri.
- `restaurant_owners` — restoran yöneticisi bağlantısı (admin panel için).
- RLS politikaları + gerekli GRANT'ler.
- Örnek restoran ve menü verileri migration ile eklenecek.

## Sayfalar ve rotalar
- `/` — Ana sayfa: hero arama, kategoriler, öne çıkan restoranlar.
- `/restaurants` — Restoran listesi: metin arama, kategori filtreleme, sıralama (puan / teslimat süresi / minimum sipariş).
- `/restaurants/$slug` — Restoran detay ve menü (sepet sheet'i).
- `/cart` — Sepet sayfası.
- `/checkout` — Adres seçimi, sipariş özeti ve Stripe ödemesine geçiş.
- `/orders/$id/success` — Ödeme sonrası sipariş onay ekranı.
- `/orders` — Kullanıcı sipariş geçmişi ve takip.
- `/orders/$id` — Sipariş detay ve durum takibi.
- `/profile` — Profil yönetimi.
- `/profile/addresses` — Adres ekleme, düzenleme, silme ve varsayılan seçme.
- `/auth` — Giriş / kayıt sayfası.
- `/_authenticated/*` — Giriş gerektiren rotalar.
- `/admin/restaurants` — Restoran yönetim paneli.
- `/admin/menu` — Menü yönetimi.
- `/admin/orders` — Gelen siparişleri yönetme ve durum güncelleme.

## İstenen 4 akış

### 1. Restoran listeleme, kategori filtreleme, arama
- Kategori çipleri (Kebap, Pizza, Burger, Tatlı, Çiğ Köfte, Ev Yemeği vb.).
- Canlı metin arama: restoran adı ve mutfak türü.
- Sıralama ve boş sonuç durumu için tasarlanmış ekran.

### 2. Ürün seçme, sepet yönetimi, sipariş oluşturma
- Menü kaleminden sepete ekleme, adet artır/azalt, kaldırma.
- Sepet durumu tek restoranla sınırlı; farklı restoran seçilirse uyarı.
- Sepet ara toplam, teslimat ücreti, minimum sipariş kontrolü.
- Sipariş kaydı `createServerFn` üzerinden sunucuda oluşturulur.

### 3. Stripe ile ödeme ve sipariş onayı
- Lovable'ın yerleşik Stripe ödeme entegrasyonu etkinleştirilecek (kendi Stripe hesabı/anahtarı gerekmez, test ortamı hazır gelir).
- Ödeme öncesi uygunluk kontrolü çalıştırılacak ve önerilen ayar uygulanacak.
- Checkout oturumu sunucuda oluşturulur, kullanıcı Stripe'a yönlenir.
- Webhook ile ödeme doğrulanır, sipariş `paid` durumuna geçer ve onay ekranı gösterilir.
- Not: Ödeme entegrasyonu Pro plan gerektirir.

### 4. Kullanıcı kaydı, giriş ve adres yönetimi
- E-posta/şifre ile kayıt ve giriş, oturum durumuna göre değişen header.
- Profil tablosu otomatik oluşturulur (trigger).
- Adres CRUD: birden fazla adres, varsayılan adres seçimi, checkout'ta kullanma.

## İlerleyiş
1. Lovable Cloud aktifleştir, tasarım sistemini ve shadcn bileşenlerini kur.
2. Şema + RLS + GRANT + örnek restoran/menü verileri.
3. Ortak layout, header (oturum duyarlı) ve footer.
4. Akış 1: anasayfa, restoran listesi, arama ve kategori filtreleme.
5. Akış 4: kayıt/giriş, profil ve adres yönetimi.
6. Akış 2: menü, sepet ve sipariş oluşturma.
7. Akış 3: Stripe etkinleştirme, checkout, webhook, sipariş onayı.
8. Sipariş takibi ve admin paneli.
9. Görsel üretimi ve son kontroller.
