export const TERMS_ACCEPTANCE_REQUIRED =
  "Devam etmek için Kullanım Koşulları, Gizlilik Politikası ve KVKK Aydınlatma Metni'ni kabul edin.";

export type LegalDocId = "terms" | "privacy" | "kvkk" | "provider" | "cancellation";

export type LegalDocument = {
  id: LegalDocId;
  title: string;
  path:
    | "/kullanim-kosullari"
    | "/gizlilik-politikasi"
    | "/kvkk"
    | "/hizmet-saglayici-bilgileri"
    | "/iptal-ve-iade";
  description: string;
  updatedLabel: string;
  paragraphs: string[];
};

const BRAND = "SİLVAN CEBİMDE";

export const LEGAL_DOCUMENTS: Record<LegalDocId, LegalDocument> = {
  terms: {
    id: "terms",
    title: "Kullanım Koşulları",
    path: "/kullanim-kosullari",
    description: `${BRAND} platformunu kullanırken geçerli kurallar.`,
    updatedLabel: "Son güncelleme: 25 Ağustos 2026",
    paragraphs: [
      `${BRAND}, Silvan ve çevresindeki esnaf ile müşterileri bir araya getiren bir çevrimiçi sipariş ve vitrin platformudur. Platforma kayıt olarak, e-posta doğrulama kodunu girerek veya hesabınıza giriş yaparak bu koşulları kabul etmiş sayılırsınız.`,
      "Hesap oluşturmak için doğru iletişim bilgileri vermeniz, e-posta adresinizi doğrulamanız ve hesabınızı başkasıyla paylaşmamanız gerekir. 18 yaşından küçükler yasal temsilcileri aracılığıyla işlem yapmalıdır.",
      "Sipariş, fiyat, stok, teslimat süresi ve işletme bilgileri ilgili esnaf tarafından güncellenir. Platform, ilan edilen içeriği iletmekle yükümlüdür; yemek üretimi, paketleme ve fiili teslimattan işletme sorumludur.",
      "Ödeme, iptal, iade ve şikayet süreçlerinde önce ilgili işletmeyle, çözülemezse platform destek kanallarıyla iletişime geçebilirsiniz. İptal ve cayma hakkı kuralları için /iptal-ve-iade sayfasına bakın. Kötüye kullanım, sahte sipariş, hakaret veya sisteme izinsiz erişim hesap kapatma sebebi olabilir.",
      "Hizmet sağlayıcıya ait unvan, adres ve iletişim bilgileri /hizmet-saglayici-bilgileri sayfasında yayımlanır.",
      "Bu metin zaman zaman güncellenebilir. Önemli değişikliklerde uygulamada veya e-posta ile duyuru yapılır. Güncel metin her zaman bu sayfada yayımlanır.",
    ],
  },
  privacy: {
    id: "privacy",
    title: "Gizlilik Politikası",
    path: "/gizlilik-politikasi",
    description: `${BRAND} kişisel verileri nasıl işler.`,
    updatedLabel: "Son güncelleme: 1 Eylül 2026",
    paragraphs: [
      `${BRAND} olarak hesabınızı oluştururken ve sipariş verirken ad-soyad, e-posta, telefon, teslimat adresi, sipariş geçmişi ve oturum bilgilerinizi işleriz. Bu veriler hesabınızı çalıştırmak, siparişi işletmeye iletmek, destek sağlamak ve yasal yükümlülükleri yerine getirmek için kullanılır.`,
      "Veri sorumlusu: İsmail Simpil. Adres: Boyunlu Küme Evler Kapı No: 264 Zemin, Boyunlu Mah., Silvan / Diyarbakır. İletişim: arkeolog871@gmail.com, 0546 696 31 33.",
      "E-posta doğrulama kodu (OTP) gönderimi, giriş güvenliği ve dolandırıcılığın önlenmesi için işlenir. Kodun kendisi düz metin olarak saklanmaz; yalnızca doğrulama ve güvenlik kayıtları tutulur.",
      "Esnaf/işletme girişlerinde telefon numarası ve bu numaraya gönderilen tek kullanımlık kod (SMS/telefon OTP) da işlenir. Telefon numarası işletme yetkilisinin kimliğini doğrulamak, panele erişimi güvenli kılmak ve sipariş bildirimlerini iletmek için kullanılır; tek kullanımlık kodlar düz metin olarak saklanmaz.",
      "Platformda reklam/vitrin alanı veren işletmelerden alınan reklam sahibi ad-unvanı ve iletişim telefonu, ayrı bir veri kategorisi olarak reklamın yayınlanması, faturalandırma ve iletişim amacıyla işlenir.",
      "Verileriniz, siparişin yerine getirilmesi için ilgili işletmeyle paylaşılabilir. Barındırma, veritabanı, e-posta gönderimi ve harita gibi hizmet sağlayıcıları yalnızca hizmeti sunmak için gerekli ölçüde erişir. Verileriniz pazarlama listelerine satılmaz.",
      "Kullandığımız barındırma ve veritabanı altyapısının sunucuları yurt dışında bulunabilir; bu durumda kişisel verileriniz mevzuatın izin verdiği ölçüde ve gerekli güvenlik önlemleri alınarak yurt dışına aktarılabilir. Altyapı sağlayıcılarının bulunduğu ülke veya bölge değişebileceğinden bu konuda belirli bir ülke taahhüdü verilmez.",
      "Veriler, hesabınız aktif olduğu sürece ve yasal saklama süreleri boyunca tutulur. Hesap ve veri silme talebinizi /hesabim sayfasındaki form üzerinden iletebilirsiniz; yasal olarak saklanması gerekenler hariç kayıtlar silinir veya anonimleştirilir.",
      "Çerezler ve benzeri teknolojiler oturum, güvenlik ve temel site işlevleri için kullanılabilir. Tarayıcı ayarlarınızdan çerezleri sınırlayabilirsiniz; bu durumda bazı özellikler çalışmayabilir.",
    ],
  },
  kvkk: {
    id: "kvkk",
    title: "KVKK Aydınlatma Metni",
    path: "/kvkk",
    description: "6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında aydınlatma.",
    updatedLabel: "Son güncelleme: 1 Eylül 2026",
    paragraphs: [
      "Veri sorumlusu: İsmail Simpil. Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu’nun 10. maddesi uyarınca hazırlanmıştır.",
      "Veri sorumlusunun adresi: Boyunlu Küme Evler Kapı No: 264 Zemin, Boyunlu Mah., Silvan / Diyarbakır.",
      "Veri sorumlusuna ulaşabileceğiniz iletişim kanalları: E-posta arkeolog871@gmail.com, telefon 0546 696 31 33.",
      "İşlenen kişisel veriler: kimlik (ad-soyad), iletişim (e-posta, telefon, adres), müşteri işlem (sipariş, sepet, ödeme durumu), işlem güvenliği (IP, oturum, doğrulama kayıtları) ve gerektiğinde konum bilgisi.",
      "İşletme/esnaf kullanıcıları için telefon numarası ve bu numaraya gönderilen tek kullanımlık giriş kodu (SMS/telefon OTP) da işlenir; bu veriler yetkili kişinin doğrulanması, panel erişim güvenliği ve sipariş bildirimi amacıyla kullanılır.",
      "Reklam/vitrin hizmeti alan işletmelerden alınan reklam sahibi adı-unvanı ve telefon numarası, ayrı bir veri kategorisi olarak reklamın yayını, iletişim ve faturalandırma amacıyla işlenir.",
      "İşleme amaçları: üyelik ve e-posta doğrulama, işletme girişinde telefon doğrulama, siparişin alınması ve işletmeye iletilmesi, teslimatın planlanması, müşteri destek, güvenlik, yasal yükümlülüklerin yerine getirilmesi ve hizmetin geliştirilmesi.",
      "Hukuki sebepler: KVKK m. 5/2 (c) bir sözleşmenin kurulması veya ifası, (ç) veri sorumlusunun hukuki yükümlüğü, (f) meşru menfaat ve açık rızanızın bulunduğu hallerde m. 5/1.",
      "Toplama yöntemi: uygulama ve web formları, e-posta OTP, telefon/SMS OTP, sipariş ve destek kanalları, otomatik kayıtlar. Aktarım: siparişi hazırlayan işletme, barındırma, veritabanı ve e-posta altyapısı, yasal merciler (talep halinde).",
      "Barındırma ve veritabanı altyapısı sağlayıcılarının sunucuları yurt dışında bulunabilir. Bu halde kişisel veriler, mevzuatın izin verdiği ölçüde ve uygun güvenlik önlemleriyle yurt dışına aktarılabilir; belirli bir ülke veya sağlayıcı taahhüdü verilmez.",
      "KVKK m. 11 kapsamındaki haklarınız: verilerinizin işlenip işlenmediğini öğrenme, bilgi talep etme, düzeltme, silme/yok etme, itiraz ve zararın giderilmesini isteme. Silme talebinizi /hesabim sayfasındaki form ile veya /hizmet-saglayici-bilgileri sayfasındaki iletişim kanallarıyla iletebilirsiniz.",
    ],
  },
  provider: {
    id: "provider",
    title: "Hizmet Sağlayıcı Bilgileri",
    path: "/hizmet-saglayici-bilgileri",
    description: `${BRAND} platformunu işleten hizmet sağlayıcıya ait kimlik ve iletişim bilgileri.`,
    updatedLabel: "Son güncelleme: 1 Eylül 2026",
    paragraphs: [
      "Unvan / Ad-Soyad: İsmail Simpil",
      "Açık adres: Boyunlu Küme Evler Kapı No: 264 Zemin, Boyunlu Mah., Silvan / Diyarbakır",
      "MERSİS No (varsa) / Vergi No: [MERSİS/VERGİ NO – DOLDURULACAK]",
      "E-posta: arkeolog871@gmail.com",
      "Telefon: 0546 696 31 33",
      `Faaliyet konusu: ${BRAND}, Silvan ve çevresindeki restoran, kafe, market, giyim ve eğlence işletmelerinin ürün ve hizmetlerini çevrimiçi olarak listeleyen, müşterilerin bu işletmelerden kapıda ödemeli sipariş vermesine aracılık eden çok satıcılı yerel pazaryeri platformudur.`,
      "Platform, siparişe konu ürünlerin üreticisi veya satıcısı değildir; ürünün hazırlanması, paketlenmesi, teslimi ve faturalandırılması ilgili işletmenin sorumluluğundadır. Sipariş, iptal, iade ve şikayet talepleri için önce ilgili işletmeye, ardından yukarıdaki iletişim kanallarına başvurabilirsiniz.",
      "Gizlilik, kişisel veriler ve iptal-iade süreçleri için /gizlilik-politikasi, /kvkk ve /iptal-ve-iade sayfalarına bakabilirsiniz.",
    ],
  },
  cancellation: {
    id: "cancellation",
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
      "Kapıda ödeme yapılan siparişlerde, iade onaylandığında ödediğiniz tutar işletme tarafından size iade edilir; iade yöntemi ve süresi işletmeyle birlikte belirlenir. Ayıplı, eksik veya yanlış gönderilen ürünlerde kargo/teslimat masrafı tüketiciden talep edilmez.",
      "Bu politika, tüketici mevzuatından doğan yasal haklarınızı ortadan kaldırmaz veya sınırlamaz.",
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
