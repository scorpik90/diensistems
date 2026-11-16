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
  /** ID организации на Яндекс.Картах — для виджета рейтинга */
  yandexOrgId?: string;
  /** Логотипы и фоны — из медиатеки Strapi */
  logo?: CmsImage | null;
  logoMark?: CmsImage | null;
  heroImage?: CmsImage | null;
  /** Тексты подвала */
  footerAbout?: string;
  footerBottom?: string;
  footerContactsTitle?: string;
  legalPolicyUrl?: string;
  /** Мета-теги по умолчанию */
  seoTitle?: string;
  seoDescription?: string;
  ogTitle?: string;
  ogDescription?: string;
}

/**
 * Изображение из медиатеки Strapi.
 *
 * Сайт больше не знает путей к файлам на диске — все снимки
 * лежат в CMS и приходят отсюда.
 */
export interface CmsImage {
  /** Абсолютный или относительный URL оригинала */
  url: string;
  width: number;
  height: number;
  alternativeText?: string | null;
  /** Производные размеры Strapi: thumbnail / small / medium / large */
  formats?: Record<string, { url: string; width: number; height: number }>;
}

/** Редактируемый текстовый блок из CMS */
export interface ContentBlock {
  key: string;
  group: string;
  title?: string | null;
  text?: string | null;
  value?: string | null;
  items?: Record<string, unknown> | null;
  order?: number;
  isActive?: boolean;
}

/** Пункт меню из CMS */
export interface MenuItem {
  group: 'header' | 'tech' | 'footer-services' | 'footer-company';
  label: string;
  href: string;
  note?: string | null;
  order?: number;
  isActive?: boolean;
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
  /** Редактируемый «краткий ответ» страницы (шаблон с подстановками) */
  answer?: string | null;
  /** Блок фактов: [{ label, value }] — value может быть шаблоном */
  facts?: { label: string; value: string }[] | null;
  /** «Что входит в стоимость»: список строк */
  includes?: (string | { text: string })[] | null;
  /** Сноска под списком */
  includesNote?: string | null;
  /** Вопросы и ответы страницы: [{ q, a }] */
  faq?: { q: string; a: string }[] | null;
  /** Описание для поисковой выдачи */
  seoDescription?: string | null;
  /** Заголовок страницы (H1) */
  heroTitle?: string | null;
  /** Фото категории */
  image?: CmsImage | null;
}

export interface Equipment {
  /** Канонический URL без ведущего слэша */
  slug: string;
  category: CategoryId;
  categoryLabel: string;
  /** URL каталога этой категории (вычисляется) */
  categorySlug?: string;
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
  /** Фотография из медиатеки Strapi */
  image: CmsImage | null;
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
  /** Фотография из медиатеки Strapi */
  image: CmsImage | null;
  imageAlt?: string;
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
