# SİLVAN CEBİMDE — Market Köprüsü

Marketin kendi programındaki fiyat ve stok değişikliklerini SİLVAN CEBİMDE'ye
otomatik taşır. Kimse elle dosya yüklemez.

## Neden böyle çalışıyor

Bizim sunucumuzun markete IP ile bağlanması **yapılamaz ve yapılmamalı**:

- Markette sabit IP yok, modem her açılışta farklı adres alıyor.
- Kasadaki bilgisayara internetten port açmak, o makinedeki ciro, stok ve
  cari hesap bilgisini dışarı açmak demek.
- Yaygın market programlarının (Wolvox, Mikro, Nebim, Logo, Zirve, Vega)
  çoğunda dışarıya açık bir API yok; veri yerel veritabanında duruyor.

Bu yüzden bağlantı **ters yönde** kurulur: markette çalışan bu küçük betik
bizim HTTPS adresimize **dışarı doğru** bağlanır. Modem ayarı, sabit IP,
güvenlik duvarı kuralı gerekmez.

## Nasıl çalışır

```
Market programı  ──dışa aktarım──>  klasördeki dosya
                                          │
                                   (köprü izliyor)
                                          │
                                   HTTPS ile gönderim
                                          ▼
                              SİLVAN CEBİMDE sunucusu
                              dosyayı okur, kataloğu günceller
```

Köprü dosyayı **olduğu gibi** gönderir; okuma işi sunucuda yapılır. Böylece
noktalı virgül ayracı, virgüllü ondalık (`45,90`), Windows-1254 kodlaması ve
bilimsel gösterime dönmüş barkod (`8,69102E+12`) gibi Türkçe biçim tuzakları
tek bir yerde çözülür — markete kurulan betiğin bunları bilmesi gerekmez.

## Kurulum

### 1. Jetonu alın

Panel → **Toplu ürün aktarımı** → _Otomatik senkron_ → **Yeni jeton üret**.

Jeton **yalnızca bir kez** gösterilir. Kaybederseniz yenisini üretip eskisini
iptal edersiniz. Jeton bir paroladır: e-posta veya WhatsApp ile paylaşmayın.

### 2. Market programını dışa aktarıma ayarlayın

Programınızda "stok listesi" / "fiyat listesi" raporunu bir klasöre **Excel
(.xlsx)** veya **CSV** olarak kaydedin. Çoğu programda bu iş zamanlanabiliyor
(her gece 03:00 gibi).

Dosyada en az şu iki sütun bulunmalı:

| Zorunlu                 | Olursa kullanılır                    |
| ----------------------- | ------------------------------------ |
| Barkod (veya stok kodu) | Ürün adı, stok, KDV, birim, kategori |
| Fiyat                   |                                      |

Sütun başlıkları Türkçe yazılabilir; program `Barkod`, `Stok Kodu`,
`Ürün Adı`, `Satış Fiyatı`, `Fiyat`, `Stok`, `KDV`, `Birim`, `Kategori`
gibi yaygın adları kendisi tanır.

### 3. Betiği çalıştırın

Dosyaları `C:\SilvanCebimde\` altına koyun, PowerShell açıp:

```powershell
cd C:\SilvanCebimde
.\silvan-kopru.ps1 -Token scb_JETONUNUZ -Path "C:\Wolvox\Aktarim" -Once
```

`-Once` bir kez gönderip çıkar — önce bununla deneyin, günlükte sonucu görün.

Sürekli çalışması için `-Once` olmadan başlatın:

```powershell
.\silvan-kopru.ps1 -Token scb_JETONUNUZ -Path "C:\Wolvox\Aktarim" -IntervalMinutes 15
```

### 4. Bilgisayar açıldığında kendiliğinden başlasın

Görev Zamanlayıcı ile (yönetici PowerShell'inde tek seferlik):

```powershell
$eylem = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument '-NoProfile -ExecutionPolicy Bypass -File "C:\SilvanCebimde\silvan-kopru.ps1" -Token scb_JETONUNUZ -Path "C:\Wolvox\Aktarim" -Once'
$tetik = New-ScheduledTaskTrigger -Once -At (Get-Date) `
  -RepetitionInterval (New-TimeSpan -Minutes 15)
Register-ScheduledTask -TaskName "SilvanCebimde Kopru" -Action $eylem -Trigger $tetik `
  -Description "Market urun listesini SILVAN CEBIMDE'ye gonderir"
```

`-Once` ile zamanlanmış görev kullanmak, sürekli çalışan bir pencereden daha
sağlamdır: betik çökse bile bir sonraki tur normal başlar.

## Parametreler

| Parametre          | Varsayılan                               | Açıklama                                      |
| ------------------ | ---------------------------------------- | --------------------------------------------- |
| `-Token`           | (zorunlu)                                | Panelden alınan jeton                         |
| `-Path`            | (zorunlu)                                | İzlenecek klasör **veya** doğrudan dosya yolu |
| `-Filter`          | `*.xlsx`, `*.csv`                        | Klasör izleniyorsa hangi dosyalar             |
| `-IntervalMinutes` | 15                                       | Kaç dakikada bir (10'un altına inmez)         |
| `-Once`            | —                                        | Bir kez gönder ve çık                         |
| `-LogFile`         | `%LOCALAPPDATA%\SilvanCebimde\kopru.log` | Günlük dosyası                                |

Klasör izleniyorsa **en son değişen** dosya gönderilir — programınız her gün
`stok_2026_09_21.xlsx` gibi yeni dosya üretiyorsa bu doğru olanı seçer.

## Davranış ayrıntıları

- **Değişmemiş dosya gönderilmez.** Dosyanın SHA-256 özeti saklanır; aynıysa
  o tur atlanır. Marketin internetini ve sunucu kotasını boşa harcamaz.
- **Yarım dosya gönderilmez.** Program dışa aktarımı bitirmemişse (dosya
  boyutu hâlâ değişiyorsa) o tur atlanır, sonraki turda gönderilir.
- **Aynı liste iki kez gitse zararsız.** Sunucu barkod/stok kodu üzerinden
  eşleştirir; kopya ürün oluşmaz, sadece fiyat ve stok güncellenir.
- **Başarısız gönderim tekrar denenir.** Yalnızca başarılı gönderimde
  "gönderildi" damgası atılır.
- **Elle yaptığınız düzeltmeler korunur.** Panelden düzelttiğiniz ürün adı,
  görsel ve açıklamanın üstüne yazılmaz; yalnızca fiyat ve stok güncellenir.

## Günlük ve sorun giderme

Günlük: `%LOCALAPPDATA%\SilvanCebimde\kopru.log`

| Günlükteki mesaj                         | Anlamı                              |
| ---------------------------------------- | ----------------------------------- |
| `Gönderildi: … 12 yeni, 340 güncellendi` | Normal çalışıyor                    |
| `… değişmemiş; gönderilmedi`             | Normal — liste değişmemiş           |
| `Jeton geçersiz veya iptal edilmiş`      | Panelden yeni jeton alın            |
| `Çok sık gönderim`                       | Aralığı büyütün (en az 10 dakika)   |
| `Dosya kabul edilmedi: …`                | Dışa aktarma ayarını kontrol edin   |
| `hâlâ yazılıyor görünüyor`               | Normal — sonraki turda gönderilecek |

## Güvenlik

- Jeton yalnızca **ürün listesi göndermeye** yarar. Sipariş okumaz, fiyat
  dışında bir şey değiştirmez, başka işletmeye erişemez.
- Sunucuda jetonun düz hâli saklanmaz, yalnızca SHA-256 özeti tutulur.
- Jeton panelden tek tıkla iptal edilir; iptal edilen jeton o an çalışmaz olur.
- Köprü giden bağlantı kurar; markete dışarıdan erişim açılmaz.

## Daha ileri: doğrudan veritabanı okuma

Bu betik dosya üzerinden çalışır ve **her programla** uyumludur. Market
programınız dışa aktarım yapamıyorsa ya da dakikalık güncelleme istiyorsanız,
köprünün programın kendi veritabanını (MSSQL/Firebird) salt-okunur okuması da
mümkün. Bunun için programın adı ve sürümü gerekiyor — tablo düzeni her
programda farklı.
