# Bölgesel sayfa yöneticiliği (yetki devri)

## Tespit edilen kök neden (menü herkese görünüyor)

`Header.tsx` menüyü şu koşulla gösteriyor: `isFounder || (!founderExists && !access.isVendor)`.
`founderExists` değeri tarayıcıdan `user_roles` tablosunda "founder" sayımıyla hesaplanıyor; fakat
veritabanı kuralları normal kullanıcıya yalnızca **kendi** rol satırlarını görme izni veriyor. Bu yüzden
normal bir müşteride sayım 0 dönüyor, `founderExists` yanlışlıkla `false` oluyor ve menü açılıyor.
Doğrulandı: `user_roles` üzerinde yalnızca "kendi satırını gör" + admin/founder politikaları var.

Ayrıca: şu anda tek sahip hesabı var (founder rolü tek kullanıcıda). Bu hesap "owner" kabul edilecek.

## Ne yapılacak

1. **Menü görünürlüğü düzeltilir.** Menü öğesi yalnızca sunucudan doğrulanan yetkiye göre çizilir:
   sahip (owner) veya sahibin yetkilendirdiği bölge yöneticisi. Diğer herkeste hiç render edilmez
   (`founderExists` tahmini koşul tamamen kaldırılır).

2. **Bölgesel yetki tablosu.** Sahip, bir kullanıcıya belirli şehir/ilçe (mahalle alanı ile) için
   panel yetkisi verir. Yetki listesi panelden verilir/geri alınır.

3. **Panel iki modda çalışır.**
   - Sahip: bugünkü tüm sekmeler.
   - Bölge yöneticisi: yalnızca kendi bölgesindeki İşletmeler, Başvurular, Menü kategorileri,
     Ürünler ve Siparişler sekmeleri. Tema/görünüm, kullanıcılar, roller, güvenlik, denetim kaydı,
     harita anahtarı, reklamlar, silme talepleri, bölge/kategori tanımları görünmez.

4. **Sahip kimliği korunur.** Bölge yöneticisi hiçbir koşulda kullanıcı/rol yönetimine erişemez;
   sahibin hesabını silemez, pasifleştiremez, rolünü değiştiremez. Bu kısıt hem arayüzde hem
   sunucu tarafında zorlanır.

## Veritabanı

Yeni tablo `public.page_manager_roles`:

| alan | tip | not |
| --- | --- | --- |
| id | uuid pk | |
| user_id | uuid → auth.users | yetkilendirilen kişi |
| granted_by | uuid → auth.users | yetkiyi veren sahip |
| city | text | zorunlu |
| district | text | zorunlu (`service_areas` listesinden seçilir) |
| is_active | boolean | varsayılan true |
| created_at / updated_at | timestamptz | updated_at trigger'ı ile |

- `unique (user_id, city, district)`, index `(user_id) where is_active`.
- GRANT: `authenticated` → SELECT; `service_role` → ALL. Yazma işlemleri yalnızca sunucu tarafından.
- RLS:
  - kullanıcı yalnızca kendi satırlarını görebilir,
  - founder (sahip) tüm satırları görüp yönetebilir,
  - INSERT/UPDATE/DELETE için `authenticated` rolüne politika verilmez (yalnızca sahip/servis).
- Yeni yardımcı fonksiyonlar (security definer, `search_path = public`):
  - `is_page_manager(_user_id uuid) returns boolean`
  - `manages_region(_user_id uuid, _city text, _district text) returns boolean`
  Bunlar hem sunucu kontrollerinde hem gerekli RLS ifadelerinde kullanılır.
- `restaurants` üzerine bölge yöneticisi için okuma/yazma politikası eklenmez; yazmalar sunucu
  fonksiyonlarından, bölge kontrolü yapıldıktan sonra gerçekleşir (mevcut mimariyle aynı).

## Sunucu tarafı

- `founder.server.ts`: yeni `assertPanelAccess(supabase, userId, claims)` → `{ isOwner, regions }`.
  Sahip için mevcut `assertFounder` (e-posta doğrulaması + 2FA) aynen çalışır; bölge yöneticisi için
  e-posta doğrulaması ve aktif yetki satırı kontrol edilir.
- Bölgeye bağlanabilen fonksiyonlar bölge filtresi/kontrolü kazanır: `listAdminData`,
  `listBusinessCatalog`, `saveBusiness`, `deleteBusiness`, `updateOrderStatus`, `saveMenuCategory`,
  `deleteMenuCategory`, `saveMenuItem`, `deleteMenuItem`, `listBusinessApplications`,
  `reviewBusinessApplication`. Hedef kaydın `city`/`district` değeri yetkili bölgeler arasında
  değilse `Forbidden`.
- Kalan tüm yönetim fonksiyonları (`setUserRole`, `deleteUser`, `createStaffUser`,
  `setVendorAssignment`, branding/tipografi/hero/iletişim, reklam, harita, taksonomi, güvenlik,
  denetim, silme talepleri, sistem hataları) `assertFounder` ile sahibe kapalı kalır — bölge
  yöneticisi bunlara erişemez.
- `setUserRole`/`deleteUser` içine ek koruma: hedef kullanıcı founder rolü taşıyorsa yalnızca o
  hesabın kendisi işlem yapabilir; founder rolünün verilmesi/geri alınması yalnızca sahibe açıktır.
- Yeni fonksiyonlar `src/lib/page-managers.functions.ts`: `listPageManagers`, `grantPageManager`,
  `revokePageManager` (hepsi `assertFounder` + `audited` ile denetim kaydına yazar).

## Arayüz

- `getMyAccessContext` artık `isPageManager` ve `regions` döner; `useAccess` bunları yayar.
- `Header.tsx`: menü öğesi koşulu `access.isFounder || access.isPageManager`.
- `kurucu.tsx`: erişim kontrolü `useAccess` üzerinden; bölge yöneticisinde yalnızca izinli sekmeler
  render edilir ve başlıkta yetkili bölgeler gösterilir.
- Yeni `src/components/founder/PageManagerPanel.tsx` (yalnızca sahip sekmesi): kullanıcı arama +
  şehir/ilçe seçimi ile yetki verme, mevcut yetkilerin listesi ve "Yetkiyi kaldır" düğmesi.

## Doğrulama

- Migration sonrası tip dosyası yenilenince typecheck + build.
- Sahip / bölge yöneticisi / normal kullanıcı için menü görünürlüğü ve panel sekmeleri kontrol edilir.
- Bölge dışı bir işletmede güncelleme denemesinin sunucu tarafında reddedildiği doğrulanır.
