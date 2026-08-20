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
- İşletme girişi telefon numarası + tek kullanımlık kod ile yapılır: numara `profiles.phone` üzerinden vendor hesabına eşlenir, kod hesabın kayıtlı e-postasına gönderilir, oturum sunucudan dönen jetonlarla kurulur. E-posta UI'da maskelenir.
- İşletme kendi panelindeki "Şifre" sekmesinden mevcut şifresini doğrulayarak yeni şifre belirleyebilir.
- Kurucu panelinde hesap oluştururken e-posta, telefon ve ad soyad zorunludur; telefon `profiles.phone` alanına normalize edilerek yazılır ve tekil olmalıdır (işletme telefon girişinin çalışması için gerekli).
- Müşteri kaydında da telefon numarası zorunludur (metadata `phone` → `handle_new_user` ile profiles'a işlenir).
