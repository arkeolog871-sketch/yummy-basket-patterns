# Yol haritası — bölgesel sayfa yöneticiliği

- [x] page_manager_roles tablosu + RLS + yardımcı fonksiyonlar (migration)
- [x] founderExists kaynaklı menü görünürlüğü hatası
- [x] getMyAccessContext/useAccess: isPageManager + regions
- [x] Header ve /kurucu erişim mantığı (isFounder || isPageManager)
- [x] Bölge yöneticisi için sınırlı panel sekmeleri
- [x] Sunucu taraflı bölge kontrolleri (işletme/ürün/sipariş/başvuru)
- [x] Sahip hesabı koruması (setUserRole, deleteUser)
- [x] PageManagerPanel (yetki ver/geri al)
- [x] typecheck + build
- [x] iPhone Google girişi: intent:// aktarımı yalnızca Android'de, doğru "bu tarayıcıda başladı" kontrolü + testler
- [ ] Apple/e-posta girişi sonrası doğrudan işletme başvuru formuna dönüş
- [x] Google Cloud harita anahtarı bağlama + Maps JavaScript API/yönlendirici doğrulaması (tüm alan adlarında OK)
- [ ] Başvuru formunda enlem/boylam yerine haritadan konum işaretleme

- [ ] Soru: ChatGPT desteği — Lovable AI zaten OpenAI modellerini kullanıyor; kendi OpenAI anahtarı istenirse ayrı bağlantı açılacak (kullanıcı onayı bekliyor).

## Yapay zekâ özellikleri (plan onaylandı)

- [x] Aşama 1 — Fotoğraftan ürün çıkarma (satıcı paneli): sunucu fonksiyonları, isimle eşleşen aktarım RPC'si, onay listesi arayüzü, testler; uçtan uca doğrulandı
- [x] Aşama 2 — Akıllı arama: ana sayfa araması serbest cümleleri anlar; AI yanıt vermezse normal aramaya döner
- [x] Aşama 3 — Sipariş asistanı sohbeti: arama/menü/sepet araçları; sipariş yalnızca kullanıcı onayıyla
- [x] Aşama 4 — Ürün açıklaması ve görseli üretme (satıcı ürün formunda "Açıklama üret" / "Görsel üret")
- [x] Güvenlik: eşleştirme kodu sütunlarında açık REVOKE (vitrin yetkileri korundu)



## Yapay zekâ asistanı (genel amaçlı)

- [x] Sesli sohbet: mikrofon kaydı → metin (google/gemini-3.5-transcribe), yanıt → ses (openai/gpt-4o-mini-tts)
- [x] Kullanıcı talimatı (kalıcı, cihazda saklanır, sistem kuralını geçersiz kılamaz)
- [x] İnternet araştırması (searchWeb + readWebPage; rehber/pazaryeri siteleri filtreli)
- [x] İşletme bilgisi YALNIZCA veritabanından (prompt + mekanik filtre)
