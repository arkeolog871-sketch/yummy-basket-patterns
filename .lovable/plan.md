# Google OAuth redirect_uri_mismatch incelemesi

## Amaç
Kullanıcı Google ile giriş yaparken `redirect_uri_mismatch` (400) hatası alıyor. Kodda Google OAuth akışının `redirect_uri` değerini bulmak ve Google Cloud Console'daki **Authorized redirect URIs** listesine eklenmesi gereken doğru adresi rapor etmek. Bu turda kod değişikliği yapılmayacak.

## Kodda bulunan mantık
`src/lib/google-oauth.ts` içindeki `googleOAuthRedirectUri()` şöyle çalışır:

- Üretim alan adları (`uygulamamcebimde.online` veya `www.uygulamamcebimde.online`) için `redirect_uri` her zaman `https://uygulamamcebimde.online/auth` olarak sabitlenir.
- `www` alt alan adından başlasa bile apex alan adına (`uygulamamcebimde.online`) yönlendirilir; çünkü Google `www` ile apex arasındaki 302 yönlendirmesini redirect URI eşleşmesinde kabul etmez.
- Önizleme / localhost ortamlarında o anki origin + `/auth` kullanılır.

Google authorization URL'i `https://accounts.google.com/o/oauth2/v2/auth` üzerinden doğrudan çağrılır; dönüş adresi uygulamanın kendi `/auth` rotasıdır, Supabase callback değildir.

## Google Cloud Console'a eklenecek URI
```text
https://uygulamamcebimde.online/auth
```

Ek notlar:
- Sonunda `/` olmamalı (`.../auth/` değil).
- Sorgu parametresi, hash veya farklı protokol olmamalı.
- `https://www.uygulamamcebimde.online/auth` ayrıca eklenmek zorunda değil; kod www'den gelen isteği de apex URI'sine sabitliyor.
- Eğer preview URL'den de Google girişi test edilecekse o preview URL'nin `/auth` yolu da (örn. `https://id-preview--...lovable.app/auth`) izin listesinde olmalı, ancak rapor edilen üretim hatası için yalnızca yukarıdaki URI yeterli.

## Çıktı
Kullanıcıya raporlanacak doğru redirect URI:
**`https://uygulamamcebimde.online/auth`**