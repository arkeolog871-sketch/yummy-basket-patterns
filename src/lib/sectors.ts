export const SECTORS = [
  { slug: "yemek", label: "Yemek" },
  { slug: "restoran", label: "Restoran" },
  { slug: "kafe", label: "Kafe" },
  { slug: "eglence", label: "Eğlence" },
  { slug: "market", label: "Market" },
  { slug: "giyim", label: "Giyim" },
] as const;

export type SectorSlug = (typeof SECTORS)[number]["slug"];

export const SECTOR_SLUGS = SECTORS.map((s) => s.slug) as readonly SectorSlug[];

export function isSectorSlug(value: unknown): value is SectorSlug {
  return typeof value === "string" && (SECTOR_SLUGS as readonly string[]).includes(value);
}

export const CITIES = [
  "Kadıköy, İstanbul",
  "Beşiktaş, İstanbul",
  "Çankaya, Ankara",
  "Konak, İzmir",
  "Nilüfer, Bursa",
  "Muratpaşa, Antalya",
] as const;

export type BusinessCardData = {
  id: string;
  name: string;
  sector: SectorSlug;
  tagline: string;
  district: string;
  tags: string[];
  rating: number;
  reviewCount: number;
  deliveryMinutes: number;
  deliveryFee: number;
  minOrder: number;
  image: string;
  badge?: string;
};

const F = "/images/restaurants";
const S = "/images/sectors";

export const MOCK_BUSINESSES: BusinessCardData[] = [
  // Yemek
  { id: "y1", name: "Ocakbaşı Dükkânı", sector: "yemek", tagline: "Meşe kömüründe Adana ve kuzu şiş", district: "Kadıköy", tags: ["Kebap", "Izgara"], rating: 4.8, reviewCount: 1240, deliveryMinutes: 30, deliveryFee: 0, minOrder: 120, image: `${F}/ocakbasi-dukkani.jpg`, badge: "Ücretsiz teslimat" },
  { id: "y2", name: "Lahmacun Evi", sector: "yemek", tagline: "Taş fırında ince hamur lahmacun", district: "Fatih", tags: ["Lahmacun", "Pide"], rating: 4.6, reviewCount: 870, deliveryMinutes: 25, deliveryFee: 12, minOrder: 80, image: `${F}/lahmacun-evi.jpg` },
  { id: "y3", name: "Anne Mutfağı", sector: "yemek", tagline: "Günlük ev yemeği ve çorbalar", district: "Üsküdar", tags: ["Ev Yemeği", "Çorba"], rating: 4.9, reviewCount: 2010, deliveryMinutes: 35, deliveryFee: 9, minOrder: 90, image: `${F}/anne-mutfagi.jpg`, badge: "Haftanın favorisi" },
  { id: "y4", name: "Çiğ Köfteci Ali Usta", sector: "yemek", tagline: "Bol baharatlı, nar ekşili çiğ köfte", district: "Şişli", tags: ["Çiğ Köfte", "Dürüm"], rating: 4.5, reviewCount: 640, deliveryMinutes: 20, deliveryFee: 0, minOrder: 60, image: `${F}/cig-kofteci-ali-usta.jpg`, badge: "Ücretsiz teslimat" },

  // Restoran
  { id: "r1", name: "Balıkçı Reis", sector: "restoran", tagline: "Günün balığı, mezeler ve rakı sofrası", district: "Beşiktaş", tags: ["Balık", "Meze"], rating: 4.7, reviewCount: 980, deliveryMinutes: 45, deliveryFee: 25, minOrder: 250, image: `${F}/balikci-reis.jpg` },
  { id: "r2", name: "Pizza Forno", sector: "restoran", tagline: "Napoli usulü taş fırın pizza", district: "Nişantaşı", tags: ["İtalyan", "Pizza"], rating: 4.6, reviewCount: 1530, deliveryMinutes: 30, deliveryFee: 15, minOrder: 150, image: `${F}/pizza-forno.jpg` },
  { id: "r3", name: "Burger Atölyesi", sector: "restoran", tagline: "El yapımı köfte, brioche ekmek", district: "Kadıköy", tags: ["Burger", "Amerikan"], rating: 4.4, reviewCount: 1120, deliveryMinutes: 28, deliveryFee: 0, minOrder: 130, image: `${F}/burger-atolyesi.jpg`, badge: "Ücretsiz teslimat" },

  // Kafe
  { id: "k1", name: "Kahve Durağı", sector: "kafe", tagline: "Üçüncü nesil kahve, günlük demleme", district: "Moda", tags: ["Kahve", "Tatlı"], rating: 4.8, reviewCount: 760, deliveryMinutes: 18, deliveryFee: 8, minOrder: 50, image: `${S}/kafe.jpg`, badge: "Yeni" },
  { id: "k2", name: "Tatlı Kaçamak", sector: "kafe", tagline: "Fıstıklı baklava ve cheesecake", district: "Bakırköy", tags: ["Pastane", "Tatlı"], rating: 4.7, reviewCount: 1340, deliveryMinutes: 22, deliveryFee: 10, minOrder: 70, image: `${F}/tatli-kacamak.jpg` },
  { id: "k3", name: "Simit & Çay Evi", sector: "kafe", tagline: "Sıcak simit, kaçak çay, serpme kahvaltı", district: "Ortaköy", tags: ["Kahvaltı", "Çay"], rating: 4.5, reviewCount: 430, deliveryMinutes: 15, deliveryFee: 0, minOrder: 40, image: `${S}/kafe.jpg`, badge: "Ücretsiz teslimat" },

  // Eğlence
  { id: "e1", name: "Bowling Arena", sector: "eglence", tagline: "10 kurtlu pist, atari ve bilardo", district: "Ataşehir", tags: ["Bowling", "Atari"], rating: 4.3, reviewCount: 320, deliveryMinutes: 0, deliveryFee: 0, minOrder: 0, image: `${S}/eglence.jpg`, badge: "Rezervasyon" },
  { id: "e2", name: "Kaçış Odası Labirent", sector: "eglence", tagline: "60 dakikada 4 farklı senaryo", district: "Beyoğlu", tags: ["Escape Room", "Grup"], rating: 4.9, reviewCount: 210, deliveryMinutes: 0, deliveryFee: 0, minOrder: 0, image: `${S}/eglence.jpg` },
  { id: "e3", name: "Sinema Kulübü", sector: "eglence", tagline: "Bağımsız filmler, mısır sınırsız", district: "Kadıköy", tags: ["Sinema", "Etkinlik"], rating: 4.6, reviewCount: 540, deliveryMinutes: 0, deliveryFee: 0, minOrder: 0, image: `${S}/eglence.jpg` },

  // Market
  { id: "m1", name: "Mahalle Marketi", sector: "market", tagline: "Meyve sebze ve temel gıda, 15 dakikada", district: "Kadıköy", tags: ["Manav", "Gıda"], rating: 4.4, reviewCount: 2210, deliveryMinutes: 15, deliveryFee: 0, minOrder: 60, image: `${S}/market.jpg`, badge: "15 dk teslimat" },
  { id: "m2", name: "Organik Sepet", sector: "market", tagline: "Sertifikalı organik ürünler", district: "Etiler", tags: ["Organik", "Manav"], rating: 4.7, reviewCount: 480, deliveryMinutes: 40, deliveryFee: 19, minOrder: 150, image: `${S}/market.jpg` },
  { id: "m3", name: "Kuruyemişçi Hacı", sector: "market", tagline: "Antep fıstığı, kavrulmuş leblebi", district: "Eminönü", tags: ["Kuruyemiş", "Baharat"], rating: 4.8, reviewCount: 690, deliveryMinutes: 35, deliveryFee: 14, minOrder: 100, image: `${S}/market.jpg` },

  // Giyim
  { id: "g1", name: "Butik Ela", sector: "giyim", tagline: "El örgüsü triko ve keten elbise", district: "Nişantaşı", tags: ["Kadın", "Butik"], rating: 4.6, reviewCount: 180, deliveryMinutes: 90, deliveryFee: 29, minOrder: 250, image: `${S}/giyim.jpg`, badge: "Aynı gün kurye" },
  { id: "g2", name: "Denim Atölye", sector: "giyim", tagline: "Ölçüye göre kot pantolon ve ceket", district: "Karaköy", tags: ["Erkek", "Denim"], rating: 4.5, reviewCount: 240, deliveryMinutes: 120, deliveryFee: 25, minOrder: 300, image: `${S}/giyim.jpg` },
  { id: "g3", name: "Minik Adımlar", sector: "giyim", tagline: "Bebek ve çocuk giyim, %100 pamuk", district: "Bostancı", tags: ["Çocuk", "Pamuk"], rating: 4.8, reviewCount: 310, deliveryMinutes: 75, deliveryFee: 0, minOrder: 200, image: `${S}/giyim.jpg`, badge: "Ücretsiz teslimat" },
];