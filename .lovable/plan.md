# iPhone Google OAuth callback düzeltme planı

## Doğrulanan kök neden

- Google girişinde tarayıcıya kaydedilen değer ham `nonce`, callback URL’sindeki `state` ise sunucuda mühürlenmiş `sc1...` değeridir. Mevcut kontrol bu iki farklı değeri doğrudan karşılaştırdığı için aynı tarayıcıda başlayan akışı bile “yetim callback” sayıyor.
- `isLikelyMobileDevice()` Android dışındaki dokunmatik cihazları da mobil kabul ediyor. Bu nedenle iPhone Safari/Chrome, Android’e özel `intent://` aktarım dalına giriyor.
- Sonuç olarak iPhone callback’i kod takasına geçmeden Android uygulamasına aktarılmaya çalışılıyor ve `/auth` bekleme ekranında kalıyor.
- `dilanakay5@gmail.com` hesabı doğrulanmış durumda; son başarılı giriş 9 Eylül. Son denemelerde auth tarafında yeni token/oturum isteği veya hesap kaynaklı hata yok. Bu, akışın `page_manager_roles`, panel erişimi veya e-posta doğrulamasına ulaşmadan kesildiğini doğruluyor.

## Uygulama

1. Android aktarımını yalnızca gerçek Android cihazlarda etkinleştir; iPhone/iPad hiçbir koşulda `intent://` dalına girmesin.
2. “Bu tarayıcıda başladı” kontrolünü ham nonce ile mühürlü state’i karşılaştırmak yerine, geçerli yerel PKCE kaydının varlığına ve callback’in uygulamaya ait `sc1` state biçimine göre güvenli biçimde belirle. Nihai state/nonce doğrulaması mevcut sunucu kod takasında yapılmaya devam etsin.
3. Yerel PKCE kaydı bulunan iPhone Safari/Chrome callback’ini doğrudan kod takası ve oturum oluşturma yoluna gönder.
4. Gerçek Android uygulama→tarayıcı yetim callback aktarımını koru; masaüstü ve mobil web girişlerini etkileme.
5. `/auth` ekranındaki zaman aşımı ve hata kapanışını koruyup, callback’in `ok: null` gibi olağandışı sonuçlarında kullanıcıya tekrar giriş yapabileceği açık bir hata durumu göster.
6. Google OAuth birim testlerine iPhone Safari, iPhone Chrome, normal Android web ve Android yetim uygulama callback senaryolarını ekle.

## Doğrulama

- İlgili OAuth birim testlerini çalıştır.
- Typecheck ve uygulama derlemesini doğrula.
- iPhone Safari kullanıcı aracısı ve dokunmatik sinyaliyle callback kararını test ederek Android aktarımının çağrılmadığını doğrula.
- Android yetim callback senaryosunda uygulamaya dönüş davranışının korunduğunu doğrula.
