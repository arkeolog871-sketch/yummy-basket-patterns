# Apple / e-posta girişinden sonra doğrudan başvuru formu

## Şu anda ne oluyor

1. Kullanıcı "İşletme başvurusu" sayfasını açıyor, "Apple ile devam et"e basıyor.
2. Apple girişi bittiğinde kullanıcı **giriş sayfasına** dönüyor.
3. Giriş sayfası, girişten sonra kullanıcıyı yalnızca ödeme sayfasına geri götürebiliyor;
   başka her durumda **ana sayfaya** atıyor.
4. Böylece kullanıcı giriş yapmış oluyor ama başvuru formunu göremiyor; formu bulmak
   için sayfayı yeniden aramak zorunda kalıyor. "Kahve Diyarı"nda yaşanan tam olarak bu.

Yani sorun kaydın başarısız olması değil; girişten sonra kullanıcının nereye
döneceğinin hatırlanmaması.

## Ne yapılacak

1. **Başvuru niyeti hatırlanacak.** Kullanıcı başvuru sayfasından Apple, Google veya
   e-posta ile girişe başladığında "bu kişi başvuru formuna dönmek istiyor" bilgisi
   tarayıcıda kısa süreli saklanacak.
2. **Giriş sonrası doğrudan forma dönüş.** Giriş tamamlandığında kullanıcı ana sayfa
   yerine doğrudan başvuru formuna götürülecek. Bu geri dönüş yalnızca uygulamanın
   kendi sayfalarına izin verecek şekilde sınırlı tutulacak (dış bağlantı adresi
   kabul edilmeyecek).
3. **Arada ek adım olmayacak.** Apple ya da e-posta ile giriş yapan kişi forma
   ulaşmak için ikinci bir doğrulama ekranı görmeyecek; giriş biter, form açılır.
   iPhone uygulamasında giriş zaten uygulama içinde tamamlandığı için sayfa
   değişmeden form anında açılacak.
4. **Bilgilendirme yazıları güncellenecek.** "Doğrulandıktan sonra bu sayfaya geri
   dönüp başvurunuzu gönderebilirsiniz" gibi artık geçerli olmayan ifadeler
   "Giriş tamamlanınca form otomatik açılır" şeklinde değişecek.

## Değişmeyecek olanlar

- Başvuru formunun alanları, zorunlulukları ve kurucu onay akışı aynı kalıyor.
- Sunucu tarafındaki güvenlik kontrolü (başvuru gönderirken hesabın doğrulanmış
  olması şartı) aynen korunuyor; sadece gereksiz ekran adımı kalkıyor.
- Ödeme sayfasından yapılan girişlerdeki mevcut geri dönüş davranışı bozulmayacak.

## Teknik ayrıntı

- `src/routes/auth.tsx`: girişten sonraki yönlendirme, tek istisna (`/odeme`) yerine
  güvenli iç yol beyaz listesinden (`/odeme`, `/isletme-basvuru`) okunacak; ayrıca
  `sessionStorage`'daki bekleyen niyet anahtarı da bu listeye göre doğrulanıp
  kullanılacak, sonra silinecek.
- Yeni küçük yardımcı (örn. `src/lib/post-login-intent.ts`): niyeti yazma/okuma/silme
  ve yol doğrulama tek yerde toplanacak; birim testi yazılacak.
- `src/routes/isletme-basvuru.tsx`: Apple/Google/e-posta akışları başlatılmadan önce
  niyet kaydedilecek; giriş tamamlandığında (`useAuth` oturumu görünce) mevcut
  "önce kimliğinizi doğrulayın" ekranı otomatik olarak forma geçecek; yardımcı
  metinler güncellenecek.
- Doğrulama: `bunx tsgo --noEmit`, ilgili birim testleri ve build kontrolü.
