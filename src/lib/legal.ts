export const TERMS_ACCEPTANCE_REQUIRED =
  "Devam etmek için Kullanım Koşulları'nı kabul edin. KVKK Aydınlatma Metni yalnızca bilgilendirme amaçlıdır.";

export type LegalDocId =
  | "terms"
  | "privacy"
  | "kvkk"
  | "provider"
  | "cancellation"
  | "kvkk_vendor"
  | "cookies"
  | "distance_sales"
  | "vendor_agreement"
  | "marketing"
  | "community"
  | "complaints"
  | "retention"
  | "security_notice";

/** Belgenin yayın sürümü; değiştiğinde yeniden onay/okuma akışı tetiklenir. */
export const LEGAL_VERSIONS: Record<LegalDocId, number> = {
  terms: 2,
  privacy: 2,
  kvkk: 2,
  provider: 2,
  cancellation: 2,
  kvkk_vendor: 1,
  cookies: 1,
  distance_sales: 1,
  vendor_agreement: 1,
  marketing: 1,
  community: 1,
  complaints: 1,
  retention: 1,
  security_notice: 1,
};

export const LEGAL_EFFECTIVE_LABEL = "Yürürlük: 24 Eylül 2026";

export type LegalDocument = {
  id: LegalDocId;
  title: string;
  path: string;
  /** İlgili taraf: müşteri, işletme veya herkes. */
  audience: "Müşteri" | "İşletme" | "Herkes";
  description: string;
  updatedLabel: string;
  paragraphs: string[];
};

const BRAND = "SİLVAN CEBİMDE";

export const LEGAL_DOCUMENTS: Record<LegalDocId, LegalDocument> = {
  terms: {
    id: "terms",
    audience: "Herkes",
    title: "Kullanım Koşulları",
    path: "/kullanim-kosullari",
    description: `${BRAND} platformunu kullanırken geçerli kurallar.`,
    updatedLabel: "Son güncelleme: 25 Ağustos 2026",
    paragraphs: [
      `${BRAND}, Silvan ve çevresindeki esnaf ile müşterileri bir araya getiren bir çevrimiçi sipariş ve vitrin platformudur. Bu koşullar, kayıt ekranındaki onay kutusunu işaretlemenizle kurulan kullanıcı sözleşmesidir; onay sürümü ve zamanı kayıt altına alınır.`,
      "Hesap oluşturmak için doğru iletişim bilgileri vermeniz, e-posta adresinizi doğrulamanız ve hesabınızı başkasıyla paylaşmamanız gerekir. 18 yaşından küçükler yasal temsilcileri aracılığıyla işlem yapmalıdır.",
      "Platform, 6563 sayılı Kanun kapsamında elektronik ticaret aracı hizmet sağlayıcıdır; siparişe konu ürünün satıcısı ilgili işletmedir. Ürün, fiyat, stok, menü, alerjen ve teslimat bilgilerinin doğruluğundan, ürünün hazırlanması, teslimi ve faturalandırılmasından işletme sorumludur. Platformun mevzuattan doğan zorunlu yükümlülükleri ve tüketicinin kanuni hakları saklıdır; bu koşulların hiçbir hükmü tüketicinin 6502 sayılı Kanun'dan doğan haklarını sınırlamaz.",
      "Ödeme, iptal, iade ve şikayet süreçlerinde önce ilgili işletmeyle, çözülemezse platform destek kanallarıyla iletişime geçebilirsiniz. İptal ve cayma hakkı kuralları için /iptal-ve-iade sayfasına bakın. Kötüye kullanım, sahte sipariş, hakaret veya sisteme izinsiz erişim hesap kapatma sebebi olabilir.",
      "Hizmet sağlayıcıya ait unvan, adres ve iletişim bilgileri /hizmet-saglayici-bilgileri sayfasında yayımlanır.",
      "Bu metin zaman zaman güncellenebilir. Önemli değişikliklerde uygulamada veya e-posta ile duyuru yapılır. Güncel metin her zaman bu sayfada yayımlanır.",
    ],
  },
  privacy: {
    id: "privacy",
    audience: "Herkes",
    title: "Gizlilik Politikası",
    path: "/gizlilik-politikasi",
    description: `${BRAND} kişisel verileri nasıl işler.`,
    updatedLabel: "Son güncelleme: 21 Eylül 2026",
    paragraphs: [
      `${BRAND} olarak hesabınızı oluştururken ve sipariş verirken ad-soyad, e-posta, telefon, teslimat adresi, sipariş geçmişi ve oturum bilgilerinizi işleriz. Bu veriler hesabınızı çalıştırmak, siparişi işletmeye iletmek, destek sağlamak ve yasal yükümlülükleri yerine getirmek için kullanılır.`,
      "Veri sorumlusu: İsmail Simpil. Adres: Boyunlu Küme Evler Kapı No: 264 Zemin, Boyunlu Mah., Silvan / Diyarbakır. İletişim: arkeolog871@gmail.com, 0546 696 31 33.",
      "E-posta doğrulama kodu (OTP) gönderimi, giriş güvenliği ve dolandırıcılığın önlenmesi için işlenir. Kodun kendisi düz metin olarak saklanmaz; yalnızca doğrulama ve güvenlik kayıtları tutulur.",
      "Esnaf/işletme girişlerinde telefon numarası ve bu numaraya gönderilen tek kullanımlık kod (SMS/telefon OTP) da işlenir. Telefon numarası işletme yetkilisinin kimliğini doğrulamak, panele erişimi güvenli kılmak ve sipariş bildirimlerini iletmek için kullanılır; tek kullanımlık kodlar düz metin olarak saklanmaz.",
      "Platformda reklam/vitrin alanı veren işletmelerden alınan reklam sahibi ad-unvanı ve iletişim telefonu, ayrı bir veri kategorisi olarak reklamın yayınlanması, faturalandırma ve iletişim amacıyla işlenir.",
      "Sesli asistanı kullandığınızda mikrofon yalnızca siz kayıt düğmesine bastığınızda açılır; arka planda dinleme yapılmaz. Kaydınız metne çevrilmek üzere sunucularımıza, oradan da yapay zekâ hizmet sağlayıcısına iletilir. Ses kaydının kendisi tarafımızca saklanmaz; işlem bittiğinde silinir.",
      "Asistanla yazışmanızın metni, giriş yapmışsanız sohbeti cihazlar arasında sürdürebilmeniz için hesabınıza bağlı olarak saklanır ve /hesabim sayfasından silinebilir. Giriş yapmamışsanız sohbet yalnızca cihazınızda kalır, sunucuya yazılmaz.",
      "Verileriniz, siparişin yerine getirilmesi için ilgili işletmeyle paylaşılabilir. Barındırma, veritabanı, e-posta gönderimi, harita ve yapay zekâ (sesli asistan, metin ve görsel üretimi) hizmet sağlayıcıları yalnızca hizmeti sunmak için gerekli ölçüde erişir. Verileriniz pazarlama listelerine satılmaz.",
      "Kullandığımız barındırma ve veritabanı altyapısının sunucuları yurt dışında bulunabilir; bu durumda kişisel verileriniz mevzuatın izin verdiği ölçüde ve gerekli güvenlik önlemleri alınarak yurt dışına aktarılabilir. Altyapı sağlayıcılarının bulunduğu ülke veya bölge değişebileceğinden bu konuda belirli bir ülke taahhüdü verilmez.",
      "Veriler, hesabınız aktif olduğu sürece ve yasal saklama süreleri boyunca tutulur. Hesap ve veri silme talebinizi /hesabim sayfasındaki form üzerinden iletebilirsiniz; yasal olarak saklanması gerekenler hariç kayıtlar silinir veya anonimleştirilir.",
      "Çerezler ve benzeri teknolojiler oturum, güvenlik ve temel site işlevleri için kullanılabilir. Tarayıcı ayarlarınızdan çerezleri sınırlayabilirsiniz; bu durumda bazı özellikler çalışmayabilir.",
    ],
  },
  kvkk: {
    id: "kvkk",
    audience: "Müşteri",
    title: "KVKK Aydınlatma Metni",
    path: "/kvkk",
    description: "6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında aydınlatma.",
    updatedLabel: "Son güncelleme: 21 Eylül 2026",
    paragraphs: [
      "Veri sorumlusu: İsmail Simpil. Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu’nun 10. maddesi uyarınca bilgilendirme amacıyla hazırlanmıştır; bir onay veya açık rıza metni değildir.",
      "Veri sorumlusunun adresi: Boyunlu Küme Evler Kapı No: 264 Zemin, Boyunlu Mah., Silvan / Diyarbakır.",
      "Veri sorumlusuna ulaşabileceğiniz iletişim kanalları: E-posta arkeolog871@gmail.com, telefon 0546 696 31 33.",
      "İşlenen kişisel veriler: kimlik (ad-soyad), iletişim (e-posta, telefon, adres), müşteri işlem (sipariş, sepet, ödeme durumu), işlem güvenliği (IP, oturum, doğrulama kayıtları), gerektiğinde konum bilgisi ve sesli asistanı kullanmanız hâlinde ses kaydınız ile asistan yazışmanızın metni.",
      "İşletme/esnaf kullanıcıları için telefon numarası ve bu numaraya gönderilen tek kullanımlık giriş kodu (SMS/telefon OTP) da işlenir; bu veriler yetkili kişinin doğrulanması, panel erişim güvenliği ve sipariş bildirimi amacıyla kullanılır.",
      "Reklam/vitrin hizmeti alan işletmelerden alınan reklam sahibi adı-unvanı ve telefon numarası, ayrı bir veri kategorisi olarak reklamın yayını, iletişim ve faturalandırma amacıyla işlenir.",
      "Sesli asistan: mikrofon yalnızca kayıt düğmesine bastığınızda açılır, arka planda dinleme yapılmaz. Ses kaydı metne çevrilmek üzere yapay zekâ hizmet sağlayıcısına aktarılır ve saklanmaz; yazışma metni giriş yapmış kullanıcılar için hesaba bağlı olarak tutulur. Sesli asistan şu an arayüzde kapalıdır; yeniden açılırsa, yurt dışı aktarım mekanizması tamamlanmadan ve ayrı bir açık rıza alınmadan ses verisi işlenmez.",
      "İşleme amaçları: üyelik ve e-posta doğrulama, işletme girişinde telefon doğrulama, siparişin alınması ve işletmeye iletilmesi, teslimatın planlanması, müşteri destek, güvenlik, yasal yükümlülüklerin yerine getirilmesi ve hizmetin geliştirilmesi.",
      "Hukuki sebepler: KVKK m. 5/2 (c) bir sözleşmenin kurulması veya ifası, (ç) veri sorumlusunun hukuki yükümlüğü, (f) meşru menfaat hükümleridir. Açık rıza yalnızca bu sebeplerin bulunmadığı ayrı işlemler için, ayrıca ve isteğe bağlı olarak istenir.",
      "Toplama yöntemi: uygulama ve web formları, e-posta OTP, telefon/SMS OTP, sipariş ve destek kanalları, otomatik kayıtlar. Aktarım: siparişi hazırlayan işletme, barındırma, veritabanı, e-posta ve yapay zekâ altyapısı, yasal merciler (talep halinde).",
      "Barındırma, veritabanı, e-posta, harita ve bildirim sağlayıcılarının sunucuları yurt dışında bulunabilir. Yurt dışı aktarım yalnızca KVKK m. 9'daki mekanizmalardan (yeterlilik kararı, standart sözleşme gibi uygun güvenceler veya arızi hâllerde istisnalar) birine dayanılarak yapılır; her sağlayıcının aktarım dayanağı veri sorumlusunun kayıtlarında ayrı ayrı izlenir ve dayanak tamamlanmayan sağlayıcı «beklemede» durumunda tutulur.",
      "KVKK m. 11 kapsamındaki haklarınız: verilerinizin işlenip işlenmediğini öğrenme, bilgi talep etme, düzeltme, silme/yok etme, itiraz ve zararın giderilmesini isteme. Silme talebinizi /hesabim sayfasındaki form ile veya /hizmet-saglayici-bilgileri sayfasındaki iletişim kanallarıyla iletebilirsiniz.",
    ],
  },
  provider: {
    id: "provider",
    audience: "Herkes",
    title: "Hizmet Sağlayıcı Bilgileri",
    path: "/hizmet-saglayici-bilgileri",
    description: `${BRAND} platformunu işleten hizmet sağlayıcıya ait kimlik ve iletişim bilgileri.`,
    updatedLabel: "Son güncelleme: 1 Eylül 2026",
    paragraphs: [
      "Unvan / Ad-Soyad: İsmail Simpil",
      "Açık adres: Boyunlu Küme Evler Kapı No: 264 Zemin, Boyunlu Mah., Silvan / Diyarbakır",
      "MERSİS ve vergi bilgileri, KEP adresi ve KVKK başvuru adresi Platform Kimliği kaydından yayımlanır; eksik alanlar tamamlanana kadar bu belge yayına hazır değil olarak işaretlenir.",
      "E-posta: arkeolog871@gmail.com",
      "Telefon: 0546 696 31 33",
      `Faaliyet konusu: ${BRAND}, Silvan ve çevresindeki restoran, kafe, market, giyim ve eğlence işletmelerinin ürün ve hizmetlerini çevrimiçi olarak listeleyen, müşterilerin bu işletmelerden kapıda ödemeli sipariş vermesine aracılık eden çok satıcılı yerel pazaryeri platformudur.`,
      "Platform, siparişe konu ürünlerin üreticisi veya satıcısı değildir; ürünün hazırlanması, paketlenmesi, teslimi ve faturalandırılması ilgili işletmenin sorumluluğundadır. Platformun aracı hizmet sağlayıcı olarak mevzuattan doğan yükümlülükleri saklıdır. Sipariş, iptal, iade ve şikayet talepleri için önce ilgili işletmeye, ardından yukarıdaki iletişim kanallarına başvurabilirsiniz.",
      "Gizlilik, kişisel veriler ve iptal-iade süreçleri için /gizlilik-politikasi, /kvkk ve /iptal-ve-iade sayfalarına bakabilirsiniz.",
    ],
  },
  cancellation: {
    id: "cancellation",
    audience: "Müşteri",
    title: "İptal ve İade / Cayma Hakkı Politikası",
    path: "/iptal-ve-iade",
    description: "Sipariş iptali, cayma hakkı ve iade süreçlerinin nasıl yürütüldüğü.",
    updatedLabel: "Son güncelleme: 31 Ağustos 2026",
    paragraphs: [
      `${BRAND} üzerinden verilen siparişler, ilgili işletme tarafından hazırlanır ve teslim edilir. Bu nedenle iptal ve iade süreçleri ürünün niteliğine göre değişir.`,
      "Restoran, kafe ve benzeri işletmelerden verilen yemek/içecek siparişleri ile çabuk bozulan veya son kullanma tarihi geçebilecek gıda ürünlerinde, Mesafeli Sözleşmeler Yönetmeliği’nin cayma hakkının istisnalarını düzenleyen hükümleri gereği cayma hakkı uygulanmaz. Bu tür siparişler yalnızca işletme hazırlığa başlamadan önce, işletmeyle iletişime geçilerek iptal edilebilir.",
      "Giyim ürünleri ile dayanıklı (çabuk bozulmayan, ambalajı açılmamış) market ürünlerinde, ürünü teslim aldığınız tarihten itibaren 14 gün içinde hiçbir gerekçe göstermeksizin cayma hakkınızı kullanabilirsiniz. Cayma hakkının kullanılabilmesi için ürünün kullanılmamış, denenme dışında yıpratılmamış, orijinal ambalajı, etiketi ve varsa aksesuarlarıyla eksiksiz olması gerekir.",
      "Hijyen ve sağlık nedeniyle iadesi uygun olmayan ürünlerde cayma hakkı kullanılamaz: ambalajı açılmış gıda ve içecekler, kozmetik ve kişisel bakım ürünleri, iç giyim, çorap, küpe gibi tek kullanımlık veya doğrudan bedenle temas eden ürünler ile ısmarlama olarak kişiye özel hazırlanan ürünler bu kapsamdadır.",
      "İade talebinizi öncelikle siparişi hazırlayan işletmeye iletmeniz gerekir; işletmenin iletişim bilgileri sipariş detay sayfasında ve işletme sayfasında yer alır. İşletme ile çözüme ulaşamazsanız talebinizi /hizmet-saglayici-bilgileri sayfasındaki platform iletişim kanallarına iletebilirsiniz. Talebinizde sipariş numarası, ürün adı ve iade gerekçesini belirtin.",
      "Kapıda ödeme yapılan siparişlerde, iade onaylandığında ödediğiniz tutar işletme tarafından size iade edilir; iade, cayma bildiriminin satıcıya ulaşmasından itibaren en geç 14 gün içinde, ödemenin yapıldığı yönteme uygun şekilde ve tüketiciye masraf yüklenmeksizin yapılır. Ayıplı, eksik veya yanlış gönderilen ürünlerde kargo/teslimat masrafı tüketiciden talep edilmez.",
      "Ayıplı ürünlerde 6502 sayılı Kanun'un 11. maddesindeki seçimlik haklarınız (sözleşmeden dönme, bedel indirimi, ücretsiz onarım, ayıpsız misliyle değişim) saklıdır. Satıcının kendi iade kuralları bu kanuni hakların önüne geçemez.",
      "Uyuşmazlıklarda parasal sınırlar dahilinde il/ilçe Tüketici Hakem Heyetlerine, üzerinde tüketici mahkemelerine başvurabilirsiniz; platform içinden şikâyet de oluşturabilirsiniz.",
      "Bu politika, tüketici mevzuatından doğan yasal haklarınızı ortadan kaldırmaz veya sınırlamaz.",
    ],
  },
  kvkk_vendor: {
    id: "kvkk_vendor",
    audience: "İşletme",
    title: "KVKK Aydınlatma Metni – İşletme ve Yetkililer",
    path: "/yasal/kvkk-isletme",
    description: "İşletme başvurusu ve paneli kullanan yetkililerin kişisel verileri hakkında bilgilendirme.",
    updatedLabel: "Son güncelleme: 24 Eylül 2026",
    paragraphs: [
      "Veri sorumlusu, Platform Kimliği kaydında yayımlanan platform işletmecisidir. Bu metin bilgilendirme amaçlıdır; onay veya açık rıza metni değildir.",
      "İşlenen veriler: yetkili kişinin ad-soyadı, telefonu, e-postası; işletmenin unvanı, adresi, vergi ve MERSİS bilgileri, faaliyet/ruhsat ve gıda kayıt belgeleri; panel oturum ve işlem güvenliği kayıtları; sipariş ve komisyon dökümleri.",
      "Amaçlar: işletme başvurusunun değerlendirilmesi ve satıcının doğrulanması (6563 sayılı Kanun ve ikincil mevzuattaki aracı hizmet sağlayıcı yükümlülükleri), aracılık sözleşmesinin kurulması ve ifası, müşteriye satıcı bilgilerinin gösterilmesi, şikâyet ve denetim süreçleri, yasal saklama yükümlülükleri.",
      "Hukuki sebepler: KVKK m. 5/2 (a) kanunlarda açıkça öngörülme, (c) sözleşmenin kurulması/ifası, (ç) hukuki yükümlülük, (e) bir hakkın tesisi, kullanılması veya korunması, (f) meşru menfaat.",
      "Satıcı bilgileri (unvan, adres, iletişim, ticari kimlik) mevzuat gereği sipariş öncesinde müşterilere gösterilir. Belgeler yalnızca doğrulama için yetkili platform personelince görülür.",
      "KVKK m. 11 haklarınız için Platform Kimliği kaydındaki KVKK başvuru adresine başvurabilirsiniz.",
    ],
  },
  cookies: {
    id: "cookies",
    audience: "Herkes",
    title: "Çerez ve Kullanım Teknolojileri Politikası",
    path: "/yasal/cerezler",
    description: "Sitede kullanılan zorunlu teknik depolama ve isteğe bağlı teknolojiler.",
    updatedLabel: "Son güncelleme: 24 Eylül 2026",
    paragraphs: [
      "Zorunlu teknik depolama: oturum anahtarı, sepet, tema ve yazı tercihleri, güvenlik ve hata kayıtları. Bunlar hizmetin çalışması için gereklidir ve tercih merkezinden kapatılamaz.",
      "Şu an analitik, reklam veya üçüncü taraf izleme teknolojisi kullanılmamaktadır. Böyle bir teknoloji eklenirse, çalıştırılmadan önce ayrı ve isteğe bağlı izniniz istenir ve tercihiniz sürümlü olarak kaydedilir.",
      "Harita gösterimi sırasında harita sağlayıcısı (Google Maps veya OpenStreetMap) kendi teknik verilerini işleyebilir; bu sağlayıcıların yurt dışı aktarım durumu KVKK aydınlatma metninde açıklanır.",
    ],
  },
  distance_sales: {
    id: "distance_sales",
    audience: "Müşteri",
    title: "Ön Bilgilendirme ve Mesafeli Satış Sözleşmesi",
    path: "/yasal/mesafeli-satis",
    description: "Sipariş vermeden önce sunulan ön bilgilendirmenin genel çerçevesi.",
    updatedLabel: "Son güncelleme: 24 Eylül 2026",
    paragraphs: [
      "Mesafeli sözleşme, müşteri ile siparişteki işletme (satıcı) arasında kurulur. Platform, aracı hizmet sağlayıcıdır ve satıcı değildir.",
      "Siparişi onaylamadan önce ödeme sayfasında şunlar gösterilir: satıcının unvanı, adresi ve iletişim bilgisi; platformun kimlik bilgisi; ürünlerin temel nitelikleri ve adetleri; vergiler dahil toplam fiyat; teslimat ücreti; ödeme yöntemi (kapıda ödeme); teslim bilgisi; cayma hakkı ve istisnaları; şikâyet ve başvuru yolları.",
      "\"Siparişi onayla\" düğmesine basılmasıyla ödeme yükümlülüğü doğar. Onay anındaki ön bilgilendirme ve sözleşme metni siparişle birlikte saklanır ve sipariş detay sayfasından her zaman görüntülenip yazdırılabilir.",
      "Cayma hakkı, istisnaları ve iade süreci İptal, İade ve Cayma Politikası'nda açıklanmıştır. Yemek ve çabuk bozulan ürünler, Mesafeli Sözleşmeler Yönetmeliği m. 15 uyarınca cayma hakkı kapsamı dışındadır; ayıplı ürün hakları saklıdır.",
    ],
  },
  vendor_agreement: {
    id: "vendor_agreement",
    audience: "İşletme",
    title: "İşletme Katılım ve Aracılık Sözleşmesi",
    path: "/yasal/isletme-sozlesmesi",
    description: "Platform ile işletme arasındaki hak ve yükümlülükler.",
    updatedLabel: "Son güncelleme: 24 Eylül 2026",
    paragraphs: [
      "Taraflar: Platform Kimliği kaydında yer alan platform işletmecisi (Aracı Hizmet Sağlayıcı) ile başvuru formunda kimliği beyan edilen ve doğrulanan işletme (Satıcı).",
      "Platformun rolü: Satıcının ürünlerini listelemek, siparişleri iletmek, şikâyet ve denetim altyapısını sağlamak. Platform, satıcı adına satış yapmaz ve müşteri ödemesini emanet olarak tutmaz; ödeme şu an kapıda doğrudan satıcıya yapılır.",
      "Satıcının yükümlülükleri: ürün adı, açıklaması, görseli, fiyatı, stoku, alerjen ve içerik bilgisinin doğru ve güncel olması; gıda mevzuatı ve ürün güvenliği kurallarına uyum; vergi ve fatura yükümlülükleri; siparişin zamanında ve eksiksiz teslimi; tüketici şikâyetlerine süresi içinde cevap verilmesi; cayma ve iade taleplerinde tüketici mevzuatına uyulması.",
      "Yasak içerik: sahte, yanıltıcı, hukuka aykırı, başkasının fikri mülkiyetini ihlal eden içerik ve görseller. Satıcı, yüklediği logo ve görselleri kullanma yetkisine sahip olduğunu beyan eder.",
      "Belge ve denetim: Satıcı, vergi levhası ve faaliyetine göre gerekli ruhsat/gıda kayıt belgelerini sunar, süresi dolan belgeleri yeniler. Belgeler eksik veya süresi dolmuşsa işletme yayına alınmaz ya da geçici olarak kapatılır.",
      "İhlal hâlinde: Platform, gerekçesini bildirerek ürünü kaldırabilir, sipariş almayı durdurabilir veya hesabı askıya alabilir; ağır ya da tekrarlanan ihlallerde sözleşmeyi feshedebilir. Satıcının kusurundan doğan ve platformun ödemek zorunda kaldığı bedeller, kanunun izin verdiği ölçüde satıcıdan talep edilebilir.",
      "Bedeller: Platformun tahsil ettiği her bedel, hizmet kalemi bazında ve sürümlü komisyon kurallarıyla belirlenir ve işletme panelinde işlem/ay bazında gösterilir. Aracılık hizmetinin asli unsurları için ayrıca bedel istenmez; kampanya, reklam ve öne çıkarma hizmetleri isteğe bağlıdır ve geri alınabilir.",
      "Kişisel veriler: Siparişin ifası için müşteri verisi satıcıyla paylaşılır; satıcı bu verileri yalnızca siparişi yerine getirmek için kullanır ve pazarlama amacıyla kullanamaz. Taraflar kendi işlemeleri bakımından ayrı veri sorumlusudur.",
      "Kayıtlar, uyuşmazlık ve sürüm: İşlem ve onay kayıtları delil niteliğinde saklanır. Mücbir sebep hâlinde yükümlülükler ertelenir. Sözleşmenin yeni sürümü yayınlandığında satıcıdan yeniden onay istenir; onay verilmeden sipariş alma yeniden açılmaz. Platformun mevzuattan doğan zorunlu yükümlülükleri saklıdır.",
    ],
  },
  marketing: {
    id: "marketing",
    audience: "Herkes",
    title: "Ticari Elektronik İleti Tercihleri",
    path: "/yasal/ticari-ileti",
    description: "Kampanya ve tanıtım iletileri için izin ve ret hakkı.",
    updatedLabel: "Son güncelleme: 24 Eylül 2026",
    paragraphs: [
      "Sipariş durumu, doğrulama kodu ve güvenlik bildirimleri hizmet iletisidir; pazarlama izni gerektirmez.",
      "Kampanya, indirim ve tanıtım iletileri (SMS, e-posta, anlık bildirim) yalnızca ayrı ve isteğe bağlı izninizle gönderilir. İzin kutusu varsayılan olarak işaretsizdir.",
      "İzninizi dilediğiniz an Hesabım sayfasından geri alabilirsiniz; ret sonrasında sistem pazarlama gönderimini teknik olarak engeller. İzin ve ret geçmişiniz İleti Yönetim Sistemi'ne (İYS) aktarılmaya uygun şekilde saklanır.",
    ],
  },
  community: {
    id: "community",
    audience: "Herkes",
    title: "Topluluk, İçerik ve Değerlendirme Kuralları",
    path: "/yasal/topluluk-kurallari",
    description: "Yorum ve içerik paylaşım kuralları.",
    updatedLabel: "Son güncelleme: 24 Eylül 2026",
    paragraphs: [
      "Yorumlar gerçek deneyime dayanmalıdır. Teslim edilmiş bir siparişe bağlı yorumlar \"Doğrulanmış sipariş\" olarak işaretlenir.",
      "Hakaret, tehdit, kişisel veri paylaşımı (telefon, adres, kimlik), reklam/spam ve yanıltıcı içerik yasaktır. Her kullanıcı işletme başına tek yorum yazabilir.",
      "Her içerik \"Bildir\" düğmesiyle raporlanabilir. Platform raporları inceler; kaldırma kararı gerekçesiyle kayda geçirilir. İşletmenin yoruma cevap hakkı vardır.",
      "Puan ortalaması yalnızca yayındaki yorumlardan hesaplanır; işletmeler puanı satın alamaz veya değiştiremez.",
    ],
  },
  complaints: {
    id: "complaints",
    audience: "Herkes",
    title: "Şikâyet ve Uyuşmazlık Çözüm Politikası",
    path: "/yasal/sikayet",
    description: "Şikâyetlerin nasıl alındığı ve sonuçlandırıldığı.",
    updatedLabel: "Son güncelleme: 24 Eylül 2026",
    paragraphs: [
      "Şikâyetinizi sipariş detay sayfasından veya Hesabım sayfasından oluşturabilirsiniz. Şikâyet önce satıcıya iletilir, satıcı cevap vermezse veya çözüm sağlanmazsa platform incelemesine geçer.",
      "Durumlar: Açık → Satıcı cevabı → Platform incelemesi → Çözüldü / Reddedildi / İade edildi / Üst mercie yönlendirildi. Cevap süreleri platform tarafından belirlenir ve şikâyet ekranında gösterilir.",
      "Taraflar yalnızca şikâyetle ilgili bilgileri görür. Tüm adımlar kayıt altına alınır.",
      "Platform süreci, Tüketici Hakem Heyeti ve tüketici mahkemesine başvuru hakkınızı ortadan kaldırmaz.",
    ],
  },
  retention: {
    id: "retention",
    audience: "Herkes",
    title: "Hesap Silme ve Veri Saklama Politikası",
    path: "/yasal/veri-saklama",
    description: "Hesap silindiğinde hangi verilerin silindiği, hangilerinin saklandığı.",
    updatedLabel: "Son güncelleme: 24 Eylül 2026",
    paragraphs: [
      "Hesap silme talebinizi Hesabım sayfasından oturumunuz doğrulanmış olarak iletirsiniz. Talep incelenir ve sonuçlandırılma tarihi kaydedilir.",
      "Silinen/anonimleştirilen veriler: profil, adres defteri, bildirim jetonları, sohbet geçmişi, pazarlama tercihleri dışındaki iletişim bilgileri.",
      "Saklanmaya devam eden veriler: sipariş ve fatura niteliğindeki kayıtlar, onay ve işlem kayıtları; bunlar vergi ve ticaret mevzuatındaki saklama süreleri boyunca kimliğinizle ilişkilendirilmeden (anonimleştirilmiş) tutulur ve süre sonunda imha edilir.",
      "Her silme işleminde hangi alanların silindiği ve hangilerinin hangi yasal gerekçeyle saklandığı kayda geçirilir.",
    ],
  },
  security_notice: {
    id: "security_notice",
    audience: "Herkes",
    title: "Güvenlik ve Kişisel Veri İhlali Bilgilendirmesi",
    path: "/yasal/guvenlik",
    description: "Güvenlik tedbirleri ve olası bir veri ihlalinde izlenecek süreç.",
    updatedLabel: "Son güncelleme: 24 Eylül 2026",
    paragraphs: [
      "Erişimler rol bazlı sınırlandırılır; işletmeler yalnızca kendi siparişlerini görür. Doğrulama kodları ve parolalar düz metin olarak saklanmaz ve kayıtlara yazılmaz; kart verisi tutulmaz.",
      "Olası bir kişisel veri ihlali tespit edildiğinde olay kayda alınır, etkisi değerlendirilir ve KVKK m. 12/5 uyarınca Kişisel Verileri Koruma Kurulu'na ve ilgili kişilere mevzuatta öngörülen süre ve usulle bildirim yapılır.",
      "Güvenlik açığı bildirmek için Platform Kimliği kaydındaki iletişim kanallarını kullanabilirsiniz.",
    ],
  },
};

export const LEGAL_LINK_ORDER: LegalDocId[] = [
  "terms",
  "privacy",
  "kvkk",
  "cancellation",
  "provider",
];

/** Yasal Merkez'de listelenen tüm belgeler. */
export const LEGAL_CENTER_ORDER: LegalDocId[] = [
  "terms",
  "distance_sales",
  "cancellation",
  "privacy",
  "kvkk",
  "kvkk_vendor",
  "cookies",
  "marketing",
  "community",
  "complaints",
  "retention",
  "security_notice",
  "vendor_agreement",
  "provider",
];

export function legalDocBySlug(slug: string): LegalDocument | null {
  return Object.values(LEGAL_DOCUMENTS).find((doc) => doc.path === `/yasal/${slug}`) ?? null;
}
