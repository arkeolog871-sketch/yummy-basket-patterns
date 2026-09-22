# Ses geçidini tek yola sabitleme

## Yapılacaklar
- Ses akışındaki doğrudan OpenAI ve Lovable AI yedeklerini tamamen kaldıracağım.
- Ses isteklerini yalnız `https://poxltwuruskxbympriz.supabase.co/functions/v1/openai-gateway/audio/transcriptions` ve `/audio/speech` uçlarına göndereceğim.
- Ağ ve HTTP hatalarında gerçek durum kodunu ve güvenli geçit mesajını kullanıcıya taşıyacağım; “geçici olarak yanıt vermiyor” genel mesajını kaldıracağım.
- Multipart yüklemede gerçek ses türünü, dosya adını ve tarayıcının otomatik boundary üretmesini koruyacağım.
- Mevcut bağlantının erişebildiği canlı fonksiyon kayıtlarını ve doğrudan uç yanıtını kontrol edeceğim; erişilemeyen dış proje verisini doğrulanmış gibi raporlamayacağım.
- İlgili testleri yeni tek-yol sözleşmesine göre güncelleyip tüm testleri çalıştıracağım; otomatik önizleme derleme sonucunu ayrıca kontrol edeceğim.

## Teknik sınırlar
- Sipariş, ödeme, oturum, erişim kuralları, canlı güncellemeler ve bildirim koduna dokunulmayacak.
- `OPENAI_API_KEY` uygulama sunucusunda veya istemcide okunmayacak; yalnız dış geçidin kendi secret'ı olarak kalacak.
- Bu çalışma alanındaki canlı bağlantı başka bir projeye bağlıysa dış projedeki fonksiyon kodunu veya secret içeriğini bu araçlarla değiştirmeyeceğim.
