---
name: İşletme paneli ürün ve görsel yönetimi
description: Vendor panelindeki ürün CRUD, stok miktarı, logo/kapak ve galeri görselleri; private bucket + /api/public/media proxy
type: feature
---
- Ürünler `menu_items` tablosunda tutulur; `stock_quantity` sütunu stok miktarıdır. Ürün kategorileri `menu_categories`.
- İşletme galerisi `business_media` tablosunda (url, storage_path, kind, position); herkes okuyabilir, yalnızca ilgili vendor/kurucu yazabilir.
- Görseller `product-images` ve `business-images` private bucket'larında; workspace public bucket'a izin vermiyor, bu yüzden `/api/public/media/<bucket>/<path>` proxy rotası ile sunulur (branding'deki `/api/public/brand/...` ile aynı desen).
- Yükleme akışı: istemci dosyayı base64'e çevirir (max 4 MB, png/jpg/webp/avif), server fn `assertVendor` sonrası `supabaseAdmin` ile yükler.
- Panel sekmeleri: Siparişler, Ürünler ve stok, Görseller, Şifre.
