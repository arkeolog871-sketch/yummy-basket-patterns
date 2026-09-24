export const TERMS_ACCEPTANCE_REQUIRED =
  "Devam etmek için Kullanım Koşulları'nı kabul edin. KVKK Aydınlatma Metni yalnızca bilgilendirme amaçlıdır.";

export type LegalDocId =
  | "terms"
  | "privacy"
  | "kvkk"
  | "provider"
  | "cancellation"
  | "kvkk_vendor"
  | "explicit_consent"
  | "cookies"
  | "distance_sales"
  | "vendor_agreement"
  | "marketing"
  | "community"
  | "complaints"
  | "retention"
  | "security_notice"
  | "records";

/** Hukuki Metin Paketi v3.0 — belge sürümü değiştiğinde yeniden onay/okuma akışı tetiklenir. */
export const LEGAL_VERSIONS: Record<LegalDocId, number> = {
  terms: 3,
  privacy: 3,
  kvkk: 3,
  provider: 3,
  cancellation: 3,
  kvkk_vendor: 3,
  explicit_consent: 3,
  cookies: 3,
  distance_sales: 3,
  vendor_agreement: 3,
  marketing: 3,
  community: 3,
  complaints: 3,
  retention: 3,
  security_notice: 3,
  records: 3,
};

export const LEGAL_PACKAGE_LABEL = "Hukuki Metin Paketi v3.0";
export const LEGAL_EFFECTIVE_LABEL = "Yürürlük: yayınlandığı tarih (24 Eylül 2026)";

export type LegalDocument = {
  id: LegalDocId;
  title: string;
  path: string;
  /** İlgili taraf: müşteri, işletme veya herkes. */
  audience: "Müşteri" | "İşletme" | "Herkes";
  description: string;
  updatedLabel: string;
  /** Nihai yayından önce hukukçu tarafından manuel doğrulanması gereken belge. */
  requiresLegalReview: boolean;
  /**
   * Paragraflar. "## " ile başlayan satır ara başlıktır. {{PLATFORM_*}} ve
   * {{KVKK_APPLICATION_ADDRESS}} değişkenleri platform kimliğinden doldurulur;
   * boş alan varsa belge "yayına hazır değil" olarak gösterilir.
   */
  paragraphs: string[];
};

/** Metin değişkeni → platform_identity sütunu. */
export const LEGAL_TOKENS = {
  PLATFORM_LEGAL_NAME: "legal_name",
  PLATFORM_BRAND: "brand_name",
  PLATFORM_ADDRESS: "address",
  PLATFORM_PHONE: "phone",
  PLATFORM_EMAIL: "email",
  PLATFORM_KEP: "kep_address",
  PLATFORM_MERSIS: "mersis_no",
  PLATFORM_TAX_OFFICE: "tax_office",
  PLATFORM_TAX_NO: "tax_no",
  KVKK_APPLICATION_ADDRESS: "kvkk_contact",
} as const;
export type LegalToken = keyof typeof LEGAL_TOKENS;

/** Boş kalırsa belgeyi yayına hazır olmaktan çıkarmayan (isteğe bağlı) alanlar. */
const OPTIONAL_TOKENS: LegalToken[] = ["PLATFORM_MERSIS", "PLATFORM_KEP", "PLATFORM_BRAND"];

const BRAND = "SİLVAN CEBİMDE";
const U = "Son güncelleme: 24 Eylül 2026";

export const LEGAL_DOCUMENTS: Record<LegalDocId, LegalDocument> = {
  terms: {
    id: "terms",
    audience: "Herkes",
    title: `${BRAND} Kullanım Koşulları`,
    path: "/kullanim-kosullari",
    description: "Platform kullanıcısı ile hizmet sağlayıcı arasındaki kullanım koşulları.",
    updatedLabel: U,
    requiresLegalReview: true,
    paragraphs: [
      "Taraflar: Platform kullanıcısı ↔ {{PLATFORM_LEGAL_NAME}}.",
      "## 1. Kapsam ve platformun niteliği",
      `${BRAND}; müşteriler ile restoran, kafe, market, mağaza ve diğer işletmeleri elektronik ortamda bir araya getiren, işletmelerin ürün/hizmetlerini sergilemesine ve müşterilerin sipariş oluşturmasına aracılık eden çok satıcılı yerel platformdur. Platformda listelenen mal/hizmetin satıcısı, sipariş ekranında belirtilen ilgili işletmedir. Platformun aracı hizmet sağlayıcı olarak kanundan doğan yükümlülükleri saklıdır.`,
      "## 2. Hesap",
      "Kullanıcı doğru ve güncel bilgi vermek, hesabını korumak ve hesabını üçüncü kişilere kullandırmamakla yükümlüdür. OTP/doğrulama kodları paylaşılmamalıdır. Kullanıcı hesabında gerçekleşen işlemlerden, mevzuatın izin verdiği ölçüde, hesap güvenliğini ihmal etmesi halinde sorumlu olabilir. Platform şüpheli erişim veya kötüye kullanım halinde hesabı geçici olarak sınırlandırabilir.",
      "## 3. Siparişin kurulması",
      "Ürün/hizmet seçimi, sepet, adres ve sipariş özeti kullanıcıya gösterilir. Siparişin hangi işletmeyle kurulduğu, ürünler, toplam bedel, teslimat bilgileri ve ödeme yöntemi sipariş öncesinde gösterilir. Sipariş onaylandığında müşteri ile ilgili işletme arasında siparişe ilişkin sözleşmesel ilişki kurulması bakımından mevzuat hükümleri uygulanır. Platformun aracı hizmet sağlayıcı sıfatı saklıdır.",
      "Mevcut ödeme yöntemi kapıda ödemedir. İleride çevrim içi ödeme eklenirse ödeme ve bedel tahsilatına ilişkin hükümler yeni sürümle yayımlanır.",
      "## 4. İşletmenin sorumlulukları",
      "İşletme; ürün/hizmetin hukuka uygunluğu, stok, fiyat, içerik, alerjen bilgileri, ürün güvenliği, hazırlanması, paketlenmesi, teslimi, faturası/fişi ve tüketiciye karşı satıcı/sağlayıcı sıfatından doğan yükümlülüklerinden sorumludur. Platformun kanuni denetim, bilgilendirme, kayıt, bildirim ve aracı hizmet sağlayıcı yükümlülükleri saklıdır.",
      "## 5. Platformun sorumluluk sınırı",
      "Platform, kanundan doğan sorumluluklarını ortadan kaldırmaz. Platformun sorumluluğu dışındaki işletme kaynaklı bir ayıp veya ifa sorunu bulunduğunda talep ilgili işletmeye yöneltilir; ancak platformun mevzuat gereği iletmesi, takip etmesi, kayıt tutması veya yerine getirmesi gereken işlemler eksiksiz yürütülür.",
      "## 6. Yasak kullanım",
      "Sahte sipariş, sistem manipülasyonu, yetkisiz erişim, kişisel veri elde etme, dolandırıcılık, hukuka aykırı ürün/hizmet, fikri mülkiyet ihlali, spam, tehdit/hakaret ve platformun güvenliğini bozacak işlemler yasaktır.",
      "## 7. İçerik",
      "Kullanıcı yorumlarının gerçek deneyime dayanması gerekir. Kişisel veri, hakaret, tehdit, yasa dışı içerik ve reklam/spam içeren yorumlar raporlanabilir. Platform raporları inceler ve gerektiğinde içeriği kaldırır veya görünürlüğünü sınırlar; kararların dayanağı ve işlem tarihi kayıt altına alınır.",
      "## 8. Değişiklik",
      "Hukuki veya işleyiş açısından önemli değişiklikler yeni sürümle yayımlanır. Kullanıcının yeniden kabulünün hukuken gerekli olduğu durumlarda hizmetin ilgili kısmı yeni sürüm kabul edilene kadar sınırlandırılabilir. Eski siparişler açısından o işlem tarihinde yürürlükte olan belge sürümü saklanır.",
      "## 9. Uyuşmazlık",
      "Tüketicinin kanuni başvuru yolları saklıdır. Tüketici hakem heyetine zorunlu başvuru için parasal sınır her yıl yeniden belirlenir (2026 yılı için 186.000 TL); başvuru öncesinde Ticaret Bakanlığı'nın güncel resmi duyurusu esas alınmalıdır.",
    ],
  },
  privacy: {
    id: "privacy",
    audience: "Herkes",
    title: "Gizlilik Politikası",
    path: "/gizlilik-politikasi",
    description: `${BRAND} genel gizlilik yaklaşımı.`,
    updatedLabel: U,
    requiresLegalReview: true,
    paragraphs: [
      `${BRAND}, kişisel verilerin işlenmesini KVKK Aydınlatma Metni'nde açıklanan amaç, veri kategorisi ve hukuki sebeplerle yürütür. Bu politika genel gizlilik yaklaşımını açıklar; hukuken zorunlu aydınlatma KVKK metninde ayrıca yapılır.`,
      "## Toplanan/işlenen veriler",
      "Hesap kimlik ve iletişim bilgileri, teslimat/adres bilgileri, sipariş/sepet/işlem kayıtları, işletme paneli yetkili bilgileri, işlem güvenliği ve oturum kayıtları, destek/şikâyet içerikleri, yorumlar, bildirim tercihleri ve teknik olarak gerekli cihaz/ağ bilgileri. Gereksiz veri toplanmaz.",
      "## Kullanım amaçları",
      "Veriler; üyelik ve hesabın işletilmesi, siparişin işletmeye iletilmesi, teslimat/iletişim, güvenlik ve dolandırıcılık önleme, müşteri destek, hukuki yükümlülükler, kayıt/ispat ve hizmetin işletilmesi amacıyla kullanılır.",
      "## İşletmeye aktarım",
      "Müşteri sipariş verdiğinde siparişin ifası için gerekli müşteri bilgileri ilgili işletmeye aktarılabilir. İşletme bu bilgileri yalnızca siparişi yerine getirmek, teslim etmek, yasal yükümlülüklerini yerine getirmek ve ilgili uyuşmazlığı çözmek için kullanabilir; bağımsız pazarlama amacıyla platformdan aldığı müşteri verisini kullanamaz.",
      "## Dış hizmetler",
      "Platformun kullandığı dış hizmetler için veri işleme rolleri ve yurt dışı aktarım hukuki dayanakları ayrı veri envanterinde tutulur. KVKK m.9 kapsamında uygun mekanizma bulunmayan yurt dışı aktarım aktif hale getirilmez.",
      "## Güvenlik",
      "Kart bilgileri platform veritabanında tutulmaz. Kimlik doğrulama kodları düz metin olarak loglanmaz.",
      "Sesli asistan veya yapay zekâ özelliği aktif edilirse ayrı veri akışı değerlendirmesi yapılır; hukuki metinler gerçek uygulama davranışıyla birebir eşleşmeden özellik yayına alınmaz.",
      "Uygulama mikrofona yalnız sesli asistanı siz başlattığınızda erişir; arka planda dinleme yapılmaz ve ses kaydı platform veritabanında saklanmaz. Sesli asistan şu anda kapalıdır.",
      "## Saklama",
      "Veriler saklama ve imha politikasına göre tutulur. Hesap silme talebi, yasal saklama yükümlülükleri saklı kalmak üzere sonuçlandırılır.",
    ],
  },
  kvkk: {
    id: "kvkk",
    audience: "Müşteri",
    title: "KVKK Aydınlatma Metni (Müşteri)",
    path: "/kvkk",
    description: "6698 sayılı KVKK m.10 kapsamında müşteri aydınlatması.",
    updatedLabel: U,
    requiresLegalReview: true,
    paragraphs: [
      "Bu metin KVKK m.10 uyarınca bilgilendirme amacıyla hazırlanmıştır; bir onay veya açık rıza metni değildir.",
      "## 1. Veri sorumlusu",
      "{{PLATFORM_LEGAL_NAME}}, {{PLATFORM_ADDRESS}}, {{PLATFORM_EMAIL}}, {{PLATFORM_PHONE}}, {{PLATFORM_KEP}}.",
      "## 2. İşlenen veri kategorileri",
      "Kimlik; iletişim; müşteri işlem; işlem güvenliği; adres/teslimat; talep/şikâyet; yorum ve değerlendirme; cihaz/uygulama teknik kayıtları; hukuken gerekli olduğu ölçüde konum verisi.",
      "Sesli asistan veya yapay zekâ özelliği açıldığında, yalnız sizin başlattığınız konuşmada ses kaydı yazıya çevrilmek üzere işlenir; bu özellik şu anda kapalıdır.",
      "## 3. İşleme amaçları",
      "Üyelik, hesap güvenliği, OTP doğrulaması, siparişin alınması ve ilgili işletmeye iletilmesi, teslimatın sağlanması, müşteri desteği, şikâyetlerin sonuçlandırılması, yorumların yönetimi, sahtecilik/kötüye kullanımın önlenmesi, yasal yükümlülükler, işlem kayıtlarının tutulması ve hakların tesisi/kullanılması/korunması.",
      "## 4. Hukuki sebepler",
      "Somut işleme faaliyetine göre KVKK m.5/2'deki sözleşmenin kurulması/ifası, kanuni yükümlülük, hakkın tesisi/kullanılması/korunması ve veri sorumlusunun meşru menfaati gibi hukuki sebepler kullanılır. Açık rıza gerektirmeyen işlemler açık rıza şartına bağlanmaz. Açık rıza gereken işlemler için ayrı metin ve ayrı irade alınır.",
      "## 5. Aktarımlar",
      "Sipariş için ilgili işletme; teknik altyapı sağlayıcıları; ödeme sağlayıcısı varsa ilgili lisanslı kuruluş; güvenlik ve iletişim hizmet sağlayıcıları; hukuken yetkili kamu kurumları. Aktarım yalnızca amaçla sınırlı ve gerekli ölçüdedir.",
      "## 6. Yurt dışı aktarım",
      "Yurt dışına aktarım ancak KVKK m.9'da öngörülen hukuki mekanizmalardan biri mevcutsa gerçekleştirilir. Yeterlilik kararı, uygun güvence/standart sözleşme veya kanundaki istisnai aktarım şartları somut veri akışına göre belgelenir. Belirsiz ifadeler tek başına aktarım hukuki dayanağı olarak kullanılmaz.",
      "## 7. İlgili kişi hakları",
      "KVKK m.11 kapsamında: kişisel veri işlenip işlenmediğini öğrenme, işlenmişse bilgi talep etme, işleme amacını ve amaca uygun kullanılıp kullanılmadığını öğrenme, yurt içinde/yurt dışında aktarılan üçüncü kişileri bilme, eksik/yanlış işlenmişse düzeltilmesini isteme, KVKK şartları çerçevesinde silme/yok etme isteme, düzeltme/silme işlemlerinin aktarılan üçüncü kişilere bildirilmesini isteme, münhasıran otomatik sistemlerle analiz sonucu aleyhe sonuca itiraz etme, kanuna aykırı işleme nedeniyle zararın giderilmesini isteme.",
      "## 8. Başvuru",
      "Başvurular {{KVKK_APPLICATION_ADDRESS}} ve {{PLATFORM_KEP}} üzerinden, KVKK'nın başvuru usulüne uygun şekilde yapılır.",
      "## 9. Aydınlatma niteliği",
      "Bu metnin kabul edilmesi veya “rıza veriyorum” şeklinde işaretlenmesi aranmaz. KVKK 2026/347 sayılı İlke Kararı gereği aydınlatma ile açık rıza birbirine bağlanmaz.",
    ],
  },
  kvkk_vendor: {
    id: "kvkk_vendor",
    audience: "İşletme",
    title: "KVKK Aydınlatma Metni (İşletme ve Yetkililer)",
    path: "/yasal/kvkk-isletme",
    description: "İşletme başvurusu ve yetkili kişilere ilişkin aydınlatma.",
    updatedLabel: U,
    requiresLegalReview: true,
    paragraphs: [
      "Veri sorumlusu: {{PLATFORM_LEGAL_NAME}}, {{PLATFORM_ADDRESS}}, {{PLATFORM_EMAIL}}. Bu metin bilgilendirme amaçlıdır; onay veya açık rıza metni değildir.",
      "İşletme başvurusunda işletmenin tüzel/gerçek kişi bilgileri, yetkili kişi bilgileri, iletişim bilgileri, doğrulama kayıtları, vergi/MERSİS ve mevzuat gerektiren ruhsat/izin/belge bilgileri işlenebilir.",
      "Amaçlar: işletmenin kimliğinin ve yetkisinin doğrulanması; platforma kabul; aracılık sözleşmesinin kurulması/ifası; satıcı bilgilerinin tüketiciye gösterilmesi; siparişlerin iletilmesi; şikâyet ve uyuşmazlıkların yönetimi; mevzuat gereği kayıt ve bildirim; güvenlik; kötüye kullanımın önlenmesi; faturalama/komisyon kayıtları.",
      "Hukuki sebepler somut işleme faaliyetine göre KVKK m.5 kapsamında belirlenir. Gereksiz kimlik belgesi kopyası tutulmaz; zorunlu olmayan hassas bilgiler toplanmaz.",
      "İşletme yetkilisinin kişisel verisi ile işletmenin ticari verisi birbirinden ayrıştırılır. İşletme adına alınan kişisel veri, gerekli olduğu ölçüde ve belirlenen amaçla kullanılır.",
      "KVKK m.11 haklarınız için başvuru adresi: {{KVKK_APPLICATION_ADDRESS}}.",
    ],
  },
  explicit_consent: {
    id: "explicit_consent",
    audience: "Herkes",
    title: "Açık Rıza Metni",
    path: "/yasal/acik-riza",
    description: "Yalnız başka işleme şartına dayanmayan isteğe bağlı işlemler için ayrı rıza.",
    updatedLabel: U,
    requiresLegalReview: true,
    paragraphs: [
      "Açık rıza sadece gerçekten gerekli olan ve başka bir KVKK işleme şartına dayandırılamayan işlemler için kullanılır. Rıza kutuları varsayılan olarak işaretli gelmez; aydınlatma metniyle birleştirilmez.",
      "## Pazarlama iletişimi (isteğe bağlı)",
      "“İsteğe bağlı pazarlama iletişimleri kapsamında kişisel verilerimin kampanya, indirim ve tanıtım amacıyla işlenmesine ve ticari elektronik ileti gönderilmesine, ilgili iletişim kanalı için ayrıca verdiğim onay doğrultusunda açık rıza veriyorum.”",
      "## Ses/yapay zekâ gibi özel işlemler (yalnız özellik açıldığında)",
      "“Belirli bir hizmetin sunulması kapsamında ses verimin işlenmesine ilişkin aydınlatmayı okudum ve belirli amaçla, özgür irademle açık rıza veriyorum.” Bu özellik şu anda uygulamada kapalıdır.",
      "Hizmetin kurulması için zorunlu olmayan rızanın reddedilmesi halinde temel hizmet sırf bu nedenle engellenmez. Rıza, Hesabım sayfasındaki tercihlerden her zaman ücretsiz geri alınabilir.",
    ],
  },
  cookies: {
    id: "cookies",
    audience: "Herkes",
    title: "Çerez ve Kullanım Teknolojileri Politikası",
    path: "/yasal/cerezler",
    description: "Zorunlu ve isteğe bağlı teknolojiler.",
    updatedLabel: U,
    requiresLegalReview: true,
    paragraphs: [
      "Zorunlu teknik teknolojiler: oturum, güvenlik, sepet, tercih ve temel uygulama işlevleri.",
      "İsteğe bağlı analitik/reklam teknolojileri ancak gerekli hukuki şartlar ve gerekiyorsa kullanıcı tercihi sağlandıktan sonra çalıştırılır. Tercih merkezi; sağlayıcı, amaç, teknoloji türü, süre ve aktarım bilgisini gösterebilir.",
      "Harita/harici medya/analitik sağlayıcıları kullanılmaya başlandığında gerçek sağlayıcılar veri envanterine eklenir ve yurt dışı aktarım değerlendirilir.",
    ],
  },
  distance_sales: {
    id: "distance_sales",
    audience: "Müşteri",
    title: "Mesafeli Sözleşme Öncesi Bilgilendirme",
    path: "/yasal/mesafeli-satis",
    description: "Sipariş öncesi dinamik ön bilgilendirmenin hukuki çerçevesi.",
    updatedLabel: U,
    requiresLegalReview: true,
    paragraphs: [
      "Bu metin dinamik sipariş öncesi özetin hukuki çerçevesidir. Sipariş ekranında statik genel metin yerine gerçek satıcı ve gerçek sipariş verileri gösterilir.",
      "## Sipariş öncesi gösterilenler",
      "Satıcının adı/unvanı; açık adresi; telefon ve gerekli iletişim bilgileri; platformun adı/unvanı ve iletişim bilgileri; ürün/hizmetin temel özellikleri; miktar; vergiler dahil toplam fiyat; teslimat/taşıma ve diğer ek masraflar; teslim/ifa süresi veya tahmini süre; ödeme yöntemi (şu anda kapıda ödeme); cayma hakkı ve istisnaları; ayıplı mal/hizmetten doğan haklar; şikâyet ve hak arama yolları.",
      "Sipariş özeti, kullanıcının hata düzeltmesine izin verir. Kullanıcı toplam bedeli ve sipariş içeriğini onayladıktan sonra “Siparişi onayla · Ödeme yükümlülüğü doğar” butonu kullanılır.",
      "Siparişin ve ön bilgilendirmenin o anda yürürlükte olan sürümü, satıcı bilgilerinin o anki kopyasıyla birlikte kayıt altına alınır ve kullanıcıya sipariş detayında erişilebilir şekilde sunulur. İşletme bilgilerinin sonradan değişmesi eski siparişin kaydını değiştirmez.",
      "Platform, tüketici talep/bildirimlerini iletebilme ve takip edebilme sistemi sağlar.",
    ],
  },
  cancellation: {
    id: "cancellation",
    audience: "Müşteri",
    title: "İptal, İade ve Cayma Politikası",
    path: "/iptal-ve-iade",
    description: "Sipariş iptali, cayma hakkı, istisnalar ve ayıplı ürün hakları.",
    updatedLabel: U,
    requiresLegalReview: true,
    paragraphs: [
      "## 1. Sipariş iptali",
      "İşletme siparişi hazırlamaya başlamadan önce iptal talebi mümkün olan durumlarda platform üzerinden işletmeye iletilir. Hazırlamaya başlanmış yemek/çabuk bozulan ürünlerde cayma hakkı bulunmayabileceği için gerçek zamanlı sipariş durumu esas alınır.",
      "## 2. Cayma",
      "Kanunda istisna bulunmayan mallarda tüketici 14 günlük süre içinde gerekçe göstermeksizin cayma hakkını kullanabilir. Süre ve başlangıç noktası ürün/hizmet türüne göre mevzuata göre uygulanır.",
      "## 3. İstisnalar",
      "Çabuk bozulan veya son kullanma tarihi geçebilecek mallar; tüketicinin istekleri veya kişisel ihtiyaçları doğrultusunda hazırlanan mallar; belirli tarihte/dönemde ifa edilmesi gereken yiyecek-içecek tedariki, konaklama vb. hizmetler; hijyen nedeniyle koruyucu unsuru açıldıktan sonra iadesi uygun olmayan ürünler ve Mesafeli Sözleşmeler Yönetmeliği'nde sayılan diğer istisnalar bakımından cayma hakkı uygulanmaz. Ancak ayıplı mal/hizmetten doğan yasal haklar saklıdır.",
      "## 4. Ayıplı/yanlış/eksik ürün",
      "Tüketicinin 6502 sayılı Kanun'daki seçimlik hakları saklıdır. Yanlış ürün, eksik ürün veya ayıp iddiası şikâyet sistemi üzerinden kayda alınır ve ilgili satıcıya iletilir. Platform, kendi mevzuat kapsamındaki yükümlülüklerini yerine getirir.",
      "## 5. İade",
      "İade yöntemi ve süreleri ilgili mevzuata göre uygulanır; tüketicinin yasal süreleri sözleşmeyle değiştirilmez.",
      "## 6. Kanuni haklar",
      "Bu politika tüketicinin kanundan doğan cayma, ayıp ve hak arama haklarını ortadan kaldırmaz.",
    ],
  },
  provider: {
    id: "provider",
    audience: "Herkes",
    title: "Hizmet Sağlayıcı / Platform Bilgileri",
    path: "/hizmet-saglayici-bilgileri",
    description: "6563 sayılı Kanun kapsamında platform kimlik ve iletişim bilgileri.",
    updatedLabel: U,
    requiresLegalReview: true,
    paragraphs: [
      "Bu sayfa yalnızca gerçek ve doğrulanmış platform kimliği bilgilerini yayımlar.",
      "Unvan / ad-soyad: {{PLATFORM_LEGAL_NAME}}",
      "Marka: {{PLATFORM_BRAND}}",
      "Adres: {{PLATFORM_ADDRESS}}",
      "Telefon: {{PLATFORM_PHONE}}",
      "E-posta: {{PLATFORM_EMAIL}}",
      "KEP: {{PLATFORM_KEP}}",
      "MERSİS: {{PLATFORM_MERSIS}}",
      "Vergi dairesi: {{PLATFORM_TAX_OFFICE}}",
      "Vergi / TC kimlik no: {{PLATFORM_TAX_NO}}",
      "KVKK başvuru adresi: {{KVKK_APPLICATION_ADDRESS}}",
      "Faaliyet: çok işletmeli yerel elektronik ticaret/aracılık platformu.",
      "Platform, siparişin konusu ürün/hizmetin satıcısı değildir; ilgili işletmenin satıcı/sağlayıcı sıfatından doğan sorumlulukları saklıdır. Bununla birlikte platformun aracı hizmet sağlayıcı olarak kanundan doğan ön bilgilendirme, kayıt, bildirim, şikâyet sistemi, içerik/işlem ve diğer zorunlu yükümlülükleri saklıdır.",
    ],
  },
  vendor_agreement: {
    id: "vendor_agreement",
    audience: "İşletme",
    title: "İşletme Katılım ve Aracılık Sözleşmesi",
    path: "/yasal/isletme-sozlesmesi",
    description: "İşletme ile platform arasındaki katılım ve aracılık koşulları.",
    updatedLabel: U,
    requiresLegalReview: true,
    paragraphs: [
      "Taraflar: İşletme ↔ {{PLATFORM_LEGAL_NAME}}.",
      "## 1. Taraflar ve doğrulama",
      "İşletme; gerçek/tüzel kişi bilgilerini, yetkili kişiyi, iletişim bilgilerini, vergi/MERSİS bilgilerini ve faaliyetine göre gerekli izin/ruhsat/belgeleri doğru sunar. Yanlış veya eksik bilgi verilmesinden kaynaklanan işletme kaynaklı sonuçlardan işletme sorumludur; platformun kanuni doğrulama yükümlülükleri saklıdır.",
      "## 2. Platform hizmeti",
      "Platform; vitrin, menü/ürün listeleme, sipariş iletimi, bildirim, müşteri talep/şikâyet sistemi ve ilgili teknik altyapıyı sağlar.",
      "## 3. İşletmenin temel sorumluluğu",
      "İşletme; ürün/hizmetin hukuka uygunluğu, fiyat/stok, ürün içeriği, alerjen, reklam iddiaları, ürün güvenliği, hazırlama, paketleme, teslim, fatura/fiş, personel ve sektörel ruhsat yükümlülüklerinden sorumludur.",
      "## 4. Müşteri verisi",
      "İşletmeye aktarılan müşteri verisi yalnızca siparişin ifası ve ilgili yasal/uyuşmazlık amaçları için kullanılabilir. İşletme platformdan aldığı müşteri verisini kendi pazarlama listesine ekleyemez; ayrı hukuki şartları yerine getirmeden ticari ileti gönderemez. İşletme yalnız kendi işletmesine ait siparişleri görebilir.",
      "## 5. İçerik ve fikri mülkiyet",
      "İşletme yüklediği fotoğraf, logo, marka, menü ve metinleri kullanmaya yetkili olduğunu beyan eder. Hukuka aykırı veya üçüncü kişilerin haklarını ihlal eden içerik kaldırılabilir.",
      "## 6. Komisyon ve ek hizmetler",
      "Yemek siparişlerinde işletmeden tahsil edilen bedeller satıcı panelinde hizmet kalemleri bazında ayrıntılı gösterilir. Temel aracılık hizmetleri için mevzuata aykırı ek bedel oluşturulmaz. Kampanya, indirim, reklam ve ek hizmetlere katılım gönüllülük esasına göre tasarlanır ve işletmenin onayını/geri alma iradesini kayıt altına alır. İndirimli satışlarda komisyon hesabı yürürlükteki düzenlemeye uygun ve şeffaf şekilde gösterilir.",
      "## 7. Askıya alma",
      "Belge eksikliği, güvenlik riski, ciddi tüketici mağduriyeti, yasa dışı ürün, sahtecilik, tekrarlanan ihlal veya mevzuatın gerektirdiği durumlarda işletme/ürün geçici olarak askıya alınabilir. Karar gerekçesi ve tarih denetim kaydına alınır. Acil güvenlik durumlarında önce durdurma sonra bildirim yapılabilir.",
      "## 8. Sözleşme sürümü",
      "Yeni sözleşme sürümünde işletmenin yeniden kabulü gerektiğinde işletme yeni sürümü kabul edene kadar ilgili faaliyetler sınırlandırılabilir.",
    ],
  },
  marketing: {
    id: "marketing",
    audience: "Herkes",
    title: "Ticari Elektronik İleti ve Pazarlama Tercihleri",
    path: "/yasal/ticari-ileti",
    description: "Hizmet iletileri ile pazarlama iletilerinin ayrımı.",
    updatedLabel: U,
    requiresLegalReview: true,
    paragraphs: [
      "Hizmet iletileri (OTP, sipariş durumu, güvenlik, hesap ve işlem bildirimleri) pazarlama iletilerinden ayrıdır.",
      "Pazarlama SMS/e-posta/push bildirimleri için hukuken gerekli onay/izin alınır; onay kanalı ve zaman damgasıyla kayıt altına alınır. Ret hakkı kolay ve ücretsiz kullanılabilir. Ret sonrası sistem gönderimi durdurur; İYS gerektiren izin/ret süreçleri İYS ile uyumlu yürütülür.",
      "İşletmelere yönelik kampanya/reklam teklifleri için işletmenin sözleşmesel ve ticari ileti tercihleri ayrıca tutulur.",
    ],
  },
  complaints: {
    id: "complaints",
    audience: "Herkes",
    title: "Şikâyet ve Uyuşmazlık Çözüm Politikası",
    path: "/yasal/sikayet",
    description: "Talep/şikâyet süreci ve durumları.",
    updatedLabel: U,
    requiresLegalReview: true,
    paragraphs: [
      "Kullanıcı sipariş detayından veya Hesabım sayfasından talep/şikâyet oluşturabilir ve durumunu takip edebilir.",
      "Durumlar: AÇIK → İŞLETMEYE İLETİLDİ → İŞLETME CEVABI → PLATFORM İNCELEMESİ → ÇÖZÜLDÜ / İADE / RED / ÜST MERCİYE YÖNLENDİRİLDİ.",
      "Her olayda sipariş, ürün, taraf, tarih, açıklama, ek belge, cevap, karar ve karar gerekçesi saklanır. Kişisel veri minimizasyonu uygulanır.",
      "Platform içi süreç, tüketicinin Tüketici Hakem Heyeti, tüketici mahkemesi ve diğer yasal başvuru haklarını ortadan kaldırmaz.",
    ],
  },
  community: {
    id: "community",
    audience: "Herkes",
    title: "Topluluk, Yorum ve İçerik Kuralları",
    path: "/yasal/topluluk-kurallari",
    description: "Yorumlar, raporlama ve içerik kararları.",
    updatedLabel: U,
    requiresLegalReview: true,
    paragraphs: [
      "Yorum gerçek deneyime dayanmalıdır. Siparişle ilişkilendirilebilen yorumlar “Doğrulanmış sipariş” olarak işaretlenebilir.",
      "Yasaklar: hakaret, tehdit, nefret söylemi, kişisel veri ifşası, şantaj, sahte yorum, spam, reklam, hukuka aykırı içerik, başkasının fikri mülkiyetini ihlal eden içerik.",
      "İşletmenin cevap hakkı vardır. İçerik raporlanabilir. Platform yalnızca rapor var diye otomatik olarak içeriği hukuka aykırı ilan etmez; inceleme sonucu ve gerekçesi kayıt altına alınır. Gerekli durumlarda görünürlük geçici olarak sınırlandırılabilir.",
    ],
  },
  retention: {
    id: "retention",
    audience: "Herkes",
    title: "Hesap Silme ve Veri Saklama",
    path: "/yasal/veri-saklama",
    description: "Hesap silme talebinde silinen, anonimleştirilen ve saklanan veriler.",
    updatedLabel: U,
    requiresLegalReview: true,
    paragraphs: [
      "Kullanıcı hesap silme talebi oluşturabilir. Kimlik doğrulama ve güvenlik kontrolü yapılır.",
      "Silinebilen/anonimleştirilebilen veriler; aktif hizmet için gerekmeyen profil, adres defteri, bildirim tokenları ve benzeri verilerdir.",
      "Kanuni saklama yükümlülüğüne tabi sipariş, fatura, muhasebe, uyuşmazlık ve ispat kayıtları ilgili mevzuatta öngörülen süre boyunca saklanabilir; bu nedenle her veri anında silinmez.",
      "Her silme işleminde silinen, anonimleştirilen ve saklanan veri kategorisi ile saklama hukuki sebebi kayıt altına alınır.",
    ],
  },
  security_notice: {
    id: "security_notice",
    audience: "Herkes",
    title: "Güvenlik ve Veri İhlali",
    path: "/yasal/guvenlik",
    description: "Teknik ve idari güvenlik önlemleri, ihlal süreci.",
    updatedLabel: U,
    requiresLegalReview: true,
    paragraphs: [
      "Platform rol bazlı erişim, işletme kapsamı/satır düzeyi erişim kuralları, yetkisiz erişim kontrolleri, güvenli kimlik doğrulama, istek sınırlama, ödeme bildirimi doğrulama, denetim kaydı ve veri minimizasyonu uygular.",
      "Parola/OTP/kart verileri gereksiz şekilde loglanmaz. İşletme yalnızca kendi işletmesine ait sipariş ve verilere erişebilir.",
      "Kişisel veri ihlali şüphesinde olay kayda alınır; kapsam, veri kategorileri, etkilenen kişiler, alınan önlemler ve bildirim değerlendirmesi belgelenir. KVKK m.12 ve ilgili mevzuattaki bildirim yükümlülükleri uygulanır.",
    ],
  },
  records: {
    id: "records",
    audience: "Herkes",
    title: "Platform ve İşletme İçin İşlem / Kayıt Politikası",
    path: "/yasal/kayit-politikasi",
    description: "Ön bilgilendirme, sipariş, kabul ve şikâyet kayıtlarının tutulması.",
    updatedLabel: U,
    requiresLegalReview: true,
    paragraphs: [
      "Mesafeli sözleşme ve elektronik ticaret işlemlerine ilişkin ön bilgilendirme, sipariş, sözleşme, bildirim, iptal, iade, şikâyet ve kabul kayıtları mevzuatta öngörülen süreler boyunca tutulur. Mesafeli sözleşmeler bakımından aracı hizmet sağlayıcı kayıtlarının üç yıl tutulması gibi açık yükümlülükler dikkate alınır.",
      "Kayıtların erişimi rol bazlıdır. Hukuki delil amacıyla denetim kayıtları sonradan sessizce değiştirilemez; düzeltme gerekiyorsa yeni düzeltme olayı oluşturulur.",
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
  "explicit_consent",
  "cookies",
  "marketing",
  "community",
  "complaints",
  "retention",
  "security_notice",
  "records",
  "vendor_agreement",
  "provider",
];

export function legalDocBySlug(slug: string): LegalDocument | null {
  return Object.values(LEGAL_DOCUMENTS).find((doc) => doc.path === `/yasal/${slug}`) ?? null;
}

type IdentityLike = Partial<Record<(typeof LEGAL_TOKENS)[LegalToken], string | null>>;

/** Belgede geçen ve zorunlu olup boş kalan değişkenler. */
export function missingTokensForDoc(docId: LegalDocId, identity: IdentityLike): LegalToken[] {
  const used = new Set<LegalToken>();
  for (const p of LEGAL_DOCUMENTS[docId].paragraphs) {
    for (const m of p.matchAll(/\{\{([A-Z_]+)\}\}/g)) used.add(m[1] as LegalToken);
  }
  return [...used].filter(
    (t) =>
      t in LEGAL_TOKENS &&
      !OPTIONAL_TOKENS.includes(t) &&
      !String(identity[LEGAL_TOKENS[t]] ?? "").trim(),
  );
}

/** Değişkenleri platform kimliğiyle doldurur; boş alan "—" olur (uydurulmaz). */
/** Eksik kimlik alanı için açık etiket (değer uydurulmaz). */
export const LEGAL_MISSING_LABEL = "Eksik — yönetici tarafından tamamlanmalı";

export function fillLegalText(text: string, identity: IdentityLike): string {
  return text.replace(/\{\{([A-Z_]+)\}\}/g, (_, key: string) => {
    if (key === "PLATFORM_BRAND") return String(identity.brand_name ?? "").trim() || BRAND;
    const col = LEGAL_TOKENS[key as LegalToken];
    return (col && String(identity[col] ?? "").trim()) || LEGAL_MISSING_LABEL;
  });
}
