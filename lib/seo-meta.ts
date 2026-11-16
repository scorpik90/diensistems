import type { StaticPage } from './types';

/**
 * Мета-теги страниц: заголовки и описания.
 *
 * Зачем это отдельный модуль, а не правка в CMS:
 *   • заголовок и описание не должны быть «как есть» из legacy —
 *     они обрезаются в выдаче примерно на 60 и 160 символах, и
 *     обрезка по границе слова выглядит аккуратнее, чем по символам;
 *   • короткие служебные заголовки («Контакты», «Прайс-лист») в выдаче
 *     не дают контекста — к ним нужен уточняющий хвост;
 *   • правила должны быть в коде, а не в данных: иначе при каждом
 *     импорте из legacy они бы перезаписывались.
 */

/** Обрезка по границе слова — без «…», чтобы не выглядело обрезанным */
export function clip(text: string, max: number): string {
  const s = text.replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[,;:\-–—\s]+$/, '');
}

/**
 * Убирает HTML-теги и сущности.
 *
 * В legacy поля excerpt и bodyHtml часто содержат готовую разметку.
 * Попав в description, она экранируется и в выдаче видны теги.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Уточняющие хвосты для служебных страниц.
 *
 * Основной источник — CMS (блок «seo.main» → hints). Здесь лежит
 * запасной вариант на случай, если CMS недоступна.
 */
const TITLE_HINTS_FALLBACK: Record<string, string> = {
  contacts: 'Контакты, адрес базы и график работы',
  nashiobekty: 'Объекты, где работали наши генераторы',
  poleznoe: 'Статьи о выборе и обслуживании техники',
  prodazhabu: 'Дизельные генераторы с гарантией',
  prodazhatopliva: 'Дизельное топливо с доставкой',
  dostavka: 'Доставка генераторов и компрессоров',
  dopoborudovanie: 'Шумозащитное ограждение генератора',
  tsenyinaarendu: 'Полный прайс на технику',
  mobilnyegeneratory: 'Мобильные станции 8–400 кВт',
  arendageneratorov: 'Диапазон мощностей и цены',
  arendakompressorov: 'Винтовые компрессоры 5–17 м³/мин',
  kompressornasmeny: 'Посменная аренда 8 часов',
  arendamanipulatora: 'Манипуляторы 3–9 тонн',
};

/** Уточняющие хвосты: из CMS, иначе — запасной вариант */
export function titleHints(hints?: Record<string, string> | null): Record<string, string> {
  return { ...TITLE_HINTS_FALLBACK, ...(hints ?? {}) };
}

/**
 * Заголовок страницы.
 *
 * Короткий заголовок дополняем уточнением, длинный — обрезаем.
 */
export function pageTitle(
  page: Pick<StaticPage, 'slug' | 'title'>,
  hints?: Record<string, string> | null
): string {
  const title = page.title.trim();
  const hint = titleHints(hints)[page.slug];

  if (title.length < 45 && hint) {
    const full = `${title}: ${hint}`;
    return clip(full, 55);
  }
  return clip(title, 55);
}

/**
 * Описание страницы.
 *
 * Описание из CMS — если оно осмысленное; иначе собираем его
 * из заголовка, уточнения и первых слов текста страницы.
 */
export function pageDescription(
  page: Pick<StaticPage, 'slug' | 'title' | 'excerpt' | 'bodyHtml'>,
  hints?: Record<string, string> | null,
  tail = '. Доставка от 2 часов, ТО и подмена включены. Москва и МО.'
): string {
  const hint = titleHints(hints)[page.slug];
  const excerpt = stripHtml(page.excerpt ?? '');

  /* Описание из CMS — если оно осмысленное */
  if (excerpt.length >= 90 && excerpt.length <= 180) return excerpt;

  /* Собираем из заголовка и уточнения */
  if (hint) {
    const full = `${page.title.trim()}: ${hint}${tail}`;
    if (full.length <= 175) return full;
  }

  /* Иначе — первые слова текста страницы */
  const text = stripHtml(page.bodyHtml ?? '');
  if (text.length > 120) {
    const cut = text.slice(0, 170);
    const lastSpace = cut.lastIndexOf(' ');
    return (lastSpace > 100 ? cut.slice(0, lastSpace) : cut).replace(/[,;:\-–—\s]+$/, '') + '…';
  }

  return excerpt || page.title;
}
