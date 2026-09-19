<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Paralel düzenleme tehlikesi (yaşanmış olay)

Bu depo iki taraftan birden değişiklik alıyor: Lovable editörü ve GitHub
pull request'leri. Lovable'ın ağacı `main`'in gerisindeyse, yaptığı
birleşme PR'dan gelen dosyaları sessizce düşürebiliyor.

19 Eylül 2026'da bu oldu (`9bbdcf6`): bir birleşme `src/lib/product-import.ts`,
`src/lib/vendor-pairing.functions.ts` ve üç göç dosyasını sildi ama onları
çağıran bileşenleri bıraktı. `main` derlenmez hale geldi
(`Cannot find module '@/lib/product-import'`). Canlı site eski dağıtımdan
geldiği için sorun fark edilmedi.

Kaçınmak için:

- Bir konu aynı anda ya Claude Code'da ya Lovable'da olsun, ikisinde birden
  değil. PR açıkken o alana Lovable'dan dokunma.
- Bir bileşen `@/lib/...` altından bir modül çağırıyor ve o dosya ağaçta
  yoksa, çözüm modülü yeniden yazmak veya bileşeni silmek değil, `main`'i
  çekmektir.
- Birleşme çakışmasında GitHub tarafında var olup sende olmayan dosyayı
  koru.
- `supabase/migrations/**` dosyalarını silme: göç üretimde uygulanmış
  olabilir, dosyayı silmek veritabanını geri almaz ama yeni ortamların
  şemasını bozar.

Aynı kurallar Lovable'ın proje bilgisine (project knowledge) de yazıldı.
