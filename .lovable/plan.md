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
- `restaurants` — restoran bilgileri, kategori, puan, teslimat süresi, minimum sipariş, kapak fotoğrafı.
- `menu_categories` — restoran menü grupları.
- `menu_items` — yemekler, fiyat, açıklama, fotoğraf.
- `orders` — siparişler, durum, toplam tutar, adres.
- `order_items` — sipariş kalemleri.
- `restaurant_owners` — restoran yöneticisi bağlantısı (admin panel için).
- RLS politikaları + gerekli GRANT'ler.
- Örnek restoran ve menü verileri migration ile eklenecek.

## Sayfalar ve rotalar
- `/` — Ana sayfa: hero arama, kategoriler, öne çıkan restoranlar.
- `/restaurants` — Restoran listesi (filtreleme, kategori, sıralama).
- `/restaurants/$slug` — Restoran detay ve menü (sepet sheet'i).
- `/cart` — Sepet sayfası.
- `/checkout` — Sipariş onay ve adres sayfası.
- `/orders` — Kullanıcı sipariş geçmişi ve takip.
- `/orders/$id` — Sipariş detay ve durum takibi.
- `/profile` — Profil yönetimi.
- `/auth` — Giriş / kayıt sayfası.
- `/_authenticated/*` — Giriş gerektiren rotalar.
- `/admin/restaurants` — Restoran yönetim paneli.
- `/admin/menu` — Menü yönetimi.
- `/admin/orders` — Gelen siparişleri yönetme ve durum güncelleme.

## Özellikler (ilk sürüm)
- Restoran listeleme ve filtreleme
- Menü görüntüleme ve sepete ekleme/çıkarma
- Kullanıcı kayıt/giriş (Lovable Cloud auth)
- Sipariş oluşturma ve takip
- Admin: restoran/menü/sipariş yönetimi

## İlerleyiş
1. Cloud aktifleştir ve tasarım sistemini kur.
2. Şema + seed verilerini yaz.
3. Ortak layout, header ve footer oluştur.
4. Public rotaları (anasayfa, restoranlar, detay, sepet, auth).
5. Auth korumalı rotaları (checkout, siparişler, profil).
6. Admin paneli.
7. Görsel üretimi ve son kontroller.
