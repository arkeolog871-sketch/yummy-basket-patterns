# Google girişinin "Yetkilendirme tamamlanıyor…" ekranında takılması

## Kök neden (tespit edildi)

Sorun bölge yöneticiliği yetkisiyle ilgili **değil**. `page_manager_roles`, `assertPanelAccess` ve `assertVerifiedEmail` kontrolleri Google callback akışında hiç çağrılmıyor — callback yalnızca kod takası + oturum kurma yapıyor.

Gerçek neden mobil cihaz tespiti:

- `src/lib/google-oauth.ts` içindeki `shouldHandoffGoogleOAuthToAndroidApp()` şu koşulla `true` dönüyor: yerleşik uygulama köprüsü yok + cihaz mobil görünüyor (`Android` veya dokunmatik ekran) + adres çubuğunda callback parametreleri var.
- `completeGoogleOAuthFromCallback()` bu durumda kodu **hiç takas etmeden** `intent://…` yönlendirmesi deniyor ve `{ ok: true }` dönüyor.
- `src/routes/auth.tsx` bu senaryoda bilinçli olarak `googleCompleting` durumunu kapatmıyor → ekran "Yetkilendirme tamamlanıyor, lütfen bekleyin…" + "Uygulamaya dön" ile kilitli kalıyor.
- Android uygulaması kurulu değilse (ya da paket adı eşleşmiyorsa) `intent://` hiçbir şey yapmıyor; butona basmak da aynı yönlendirmeyi tekrar denediği için giriş asla tamamlanmıyor.

Yani: giriş **telefondaki normal tarayıcıdan** başlatıldığında her hesap için kilitleniyor. Sahip hesabının çalışması hesap türünden değil, girişin masaüstünden ya da uygulama içinden (köprü mevcut) yapılmasından kaynaklanıyor. Aynı hata Apple akışında da var.

Ek olarak tespit edilen küçük kusur: `/auth` giriş sonrası yönlendirmesi yalnızca `isFounder` ve `isVendor` durumlarını biliyor; bölge yöneticisi panele değil ana sayfaya gidiyor.

## Yapılacak düzeltme

1. `src/lib/google-oauth.ts`
   - Handoff kararını "akış bu tarayıcıda başlamış mı" sinyaline bağla: bu tarayıcıda saklı PKCE kaydı varsa (nonce, gelen `state` ile eşleşiyorsa) **asla** handoff yapma, kodu burada takas et.
   - Handoff sadece saklı PKCE kaydı yokken (gerçekten uygulamadan başlamış, tarayıcıda yetim kalmış sekme) denensin.
   - `isOrphanedAndroidOAuthBrowser()` aynı yeni koşulu kullansın, böylece "Uygulamaya dön" kutusu yalnızca gerçekten gerekli olduğunda görünsün.
2. `src/lib/apple-oauth.ts` — aynı düzeltmeyi simetrik uygula.
3. `src/routes/auth.tsx`
   - Takas sonucu `{ ok: null }` veya beklenmedik durumda ekran kilitlenmesin; hata olmadığında da bekleme durumu kapatılsın.
   - Giriş sonrası yönlendirmede `useAccess().homePath` kullan; bölge yöneticisi `/kurucu` paneline gitsin.
4. Doğrulama: `bunx tsgo --noEmit`, ilgili birim testleri (`tests/unit/google-oauth.test.ts`) ve build kontrolü. Handoff kararı için saklı PKCE kaydı olan/olmayan iki durumu kapsayan birim testi eklenecek.

## Teknik notlar

- Google `state` değeri `sc1` önekiyle sunucuda mühürlendiği için `isGoogleOAuthCallbackParams()` saklı kayıt olmadan da `true` dönüyor; handoff kararı bu yüzden yanlış tarafa düşüyordu. Yeni ayrım noktası `readGoogleOAuthPkce()?.nonce === state`.
- Sunucu tarafı kod takası (`exchangeGoogleOAuthCode`) ve `supabase.auth.signInWithIdToken` akışı değişmiyor; yalnızca hangi durumda çağrıldığı düzeliyor.
