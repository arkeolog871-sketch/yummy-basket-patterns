---
name: Rol tabanlı yetkilendirme ve işletme paneli
description: Kurucu, işletme (vendor) ve müşteri yetki sınırları; vendor_assignments; /vendor/dashboard paneli
type: feature
---
- `vendor_assignments` tablosu her işletme kullanıcısını tek bir restorana bağlar; RLS `is_vendor_of()` ile çalışır.
- İşletme yetkileri: kendi siparişlerini görme/durum güncelleme, kendi ürünlerinin stok durumu, mağaza açık/kapalı.
- İşletme kurucu paneline, tema/görsel ayarlarına, diğer işletmelerin verilerine erişemez (UI 403 + RLS).
- Giriş ekranında "İşletme girişi" sekmesi var; giriş sonrası rol bazlı yönlendirme: kurucu → /kurucu, vendor → /vendor/dashboard, müşteri → /.
- /admin ve /admin/* rotaları 403 ekranı gösterip kullanıcıyı kendi paneline yönlendirir.
- Boş veri durumlarında `EmptyState` bileşeni kullanılır.
