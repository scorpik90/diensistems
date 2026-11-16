/**
 * Типы данных — единый контракт между CMS и представлением.
 *
 * Модель v2: 6 легаси-шаблонов техники свёрнуты в одну сущность
 * `equipment` с дискриминатором `category`.
 */

export interface SiteSettings {
  company: string;
  legalName: string;
  phone: string;
  phoneRaw: string;
  email: string;
  address: string;
  city: string;
  foundedYear: number;
  fleetMW: number;
  deliveryHours: number;
  rating: number;
  ratingCount: number;
  workingHours: string;
  discountFromDays: number;
  discountPercent: number;
  /** Страница отзывов на Яндекс.Картах */
  yandexReviewsUrl: string;
}

export interface SpecRow {
  label: string;
  value: string;
}

export interface SpecGroup {
  group: string;
  rows: SpecRow[];
}

export interface Price {
  value: number;
  unit: string;
}

export type CategoryId =
  | 'generator'
  | 'pes'
  | 'compressor'
  | 'compressor-shift'
  | 'manipulator'
  | 'used';

export interface Category {
  id: CategoryId;
  label: string;
  slug: string;
  unit: string;
  /** В CMS категория хранится с полем «key» — тот же идентификатор */
  key?: CategoryId;
}

export interface Equipment {
  /** Канонический URL без ведущего слэша */
  slug: string;
  category: CategoryId;
  categoryLabel: string;
  /** URL каталога этой категории (вычисляется) */
  categorySlug?: string;
  /** Каталог с оптимизированными картинками (вычисляется) */
  imageDir?: string | null;
  title: string;
  /** Полное легаси-заголовок (может содержать цену) */
  titleFull: string;
  model: string;
  /** Бренд: Airman, Denyo, Cummins, HINO, ISUZU, Atlas Copco */
  brand: string | null;
  /** Метка «Новинка» — ставится менеджером в CMS */
  isNew?: boolean;
  power: number | null;
  powerUnit: string;
  price: Price | null;
  priceRaw: string;
  specGroups: SpecGroup[];
  image: string | null;
  imageAlt: string;
  description: string;
  /** Все legacy-URL этой позиции — источник 301-редиректов */
  legacyUrls: string[];
}

export interface Review {
  author: string;
  rating: number;
  text: string;
  date: string;
  sourceUrl: string;
  /** Прямые ссылки на фотографии из отзыва (CDN Яндекс.Карт) */
  photos?: string[];
  order?: number;
}

export interface Article {
  slug: string;
  title: string;
  bodyHtml: string;
  excerpt: string;
  legacyUrls: string[];
}

export interface CaseStudy {
  slug: string;
  title: string;
  kW: number | null;
  bodyHtml: string;
  image: string | null;
  legacyUrls: string[];
}

export type PageKind = 'static' | 'catalog' | 'price' | 'cases' | 'articles' | 'contacts';

export interface StaticPage {
  slug: string;
  title: string;
  bodyHtml: string;
  excerpt: string;
  kind: PageKind;
  /** Для kind === 'catalog' — какая категория показывается */
  category?: CategoryId;
  legacyUrls: string[];
}

export interface PriceCell {
  text: string;
  strong: string | null;
  link: string | null;
  /** Объединение ячеек по горизонтали (из legacy-разметки) */
  colspan?: number;
  /** Объединение ячеек по вертикали (из legacy-разметки) */
  rowspan?: number;
}

export interface PriceTable {
  index: number;
  rows: PriceCell[][];
}

export interface Seed {
  meta: {
    source: string;
    migratedAt: string;
    legacyUrlCount: number;
    equipmentCount: number;
    articleCount: number;
    caseCount: number;
    pageCount: number;
  };
  settings: SiteSettings;
  categories: Category[];
  equipment: Equipment[];
  articles: Article[];
  reviews: Review[];
  cases: CaseStudy[];
  pages: StaticPage[];
  priceTables: PriceTable[];
  /** Карта 301-редиректов: legacy-URL → канонический путь */
  redirects: Record<string, string>;
}
