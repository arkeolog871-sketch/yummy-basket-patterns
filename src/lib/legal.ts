export const TERMS_ACCEPTANCE_REQUIRED =
  "Devam etmek için Kullanım Koşulları, Gizlilik Politikası ve KVKK Aydınlatma Metni'ni kabul edin.";

export type LegalDocId = "terms" | "privacy" | "kvkk";

export type LegalDocument = {
  id: LegalDocId;
  title: string;
  path: "/kullanim-kosullari" | "/gizlilik-politikasi" | "/kvkk";
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
      "Ödeme, iptal, iade ve şikayet süreçlerinde önce ilgili işletmeyle, çözülemezse platform destek kanallarıyla iletişime geçebilirsiniz. Kötüye kullanım, sahte sipariş, hakaret veya sisteme izinsiz erişim hesap kapatma sebebi olabilir.",
      "Bu metin zaman zaman güncellenebilir. Önemli değişikliklerde uygulamada veya e-posta ile duyuru yapılır. Güncel metin her zaman bu sayfada yayımlanır.",
    ],
  },
  privacy: {
    id: "privacy",
    title: "Gizlilik Politikası",
    path: "/gizlilik-politikasi",
    description: `${BRAND} kişisel verileri nasıl işler.`,
    updatedLabel: "Son güncelleme: 25 Ağustos 2026",
    paragraphs: [
      `${BRAND} olarak hesabınızı oluştururken ve sipariş verirken ad-soyad, e-posta, telefon, teslimat adresi, sipariş geçmişi ve oturum bilgilerinizi işleriz. Bu veriler hesabınızı çalıştırmak, siparişi işletmeye iletmek, destek sağlamak ve yasal yükümlülükleri yerine getirmek için kullanılır.`,
      "E-posta doğrulama kodu (OTP) gönderimi, giriş güvenliği ve dolandırıcılığın önlenmesi için işlenir. Kodun kendisi düz metin olarak saklanmaz; yalnızca doğrulama ve güvenlik kayıtları tutulur.",
      "Verileriniz, siparişin yerine getirilmesi için ilgili işletmeyle paylaşılabilir. Barındırma, e-posta gönderimi ve harita gibi hizmet sağlayıcıları yalnızca hizmeti sunmak için gerekli ölçüde erişir. Verileriniz pazarlama listelerine satılmaz.",
      "Veriler, hesabınız aktif olduğu sürece ve yasal saklama süreleri boyunca tutulur. Hesap silme talebinizi ilettiğinizde, yasal olarak saklanması gerekenler hariç kayıtlar silinir veya anonimleştirilir.",
      "Çerezler ve benzeri teknolojiler oturum, güvenlik ve temel site işlevleri için kullanılabilir. Tarayıcı ayarlarınızdan çerezleri sınırlayabilirsiniz; bu durumda bazı özellikler çalışmayabilir.",
    ],
  },
  kvkk: {
    id: "kvkk",
    title: "KVKK Aydınlatma Metni",
    path: "/kvkk",
    description: "6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında aydınlatma.",
    updatedLabel: "Son güncelleme: 25 Ağustos 2026",
    paragraphs: [
      `Veri sorumlusu: ${BRAND} platformunu işleten işletme. Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu’nun 10. maddesi uyarınca hazırlanmıştır.`,
      "İşlenen kişisel veriler: kimlik (ad-soyad), iletişim (e-posta, telefon, adres), müşteri işlem (sipariş, sepet, ödeme durumu), işlem güvenliği (IP, oturum, doğrulama kayıtları) ve gerektiğinde konum bilgisi.",
      "İşleme amaçları: üyelik ve e-posta doğrulama, siparişin alınması ve işletmeye iletilmesi, teslimatın planlanması, müşteri destek, güvenlik, yasal yükümlülüklerin yerine getirilmesi ve hizmetin geliştirilmesi.",
      "Hukuki sebepler: KVKK m. 5/2 (c) bir sözleşmenin kurulması veya ifası, (ç) veri sorumlusunun hukuki yükümlülüğü, (f) meşru menfaat ve açık rızanızın bulunduğu hallerde m. 5/1.",
      "Toplama yöntemi: uygulama ve web formları, e-posta OTP, sipariş ve destek kanalları, otomatik kayıtlar. Aktarım: siparişi hazırlayan işletme, barındırma ve e-posta altyapısı, yasal merciler (talep halinde).",
      "KVKK m. 11 kapsamındaki haklarınız: verilerinizin işlenip işlenmediğini öğrenme, bilgi talep etme, düzeltme, silme/yok etme, itiraz ve zararın giderilmesini isteme. Taleplerinizi sitedeki iletişim kanalları üzerinden iletebilirsiniz.",
    ],
  },
};

export const LEGAL_LINK_ORDER: LegalDocId[] = ["terms", "privacy", "kvkk"];
