/**
 * Подстановки для редактируемых текстов.
 *
 * Тексты в CMS хранятся с шаблонными метками ({price}, {count}).
 * Числа подставляются из каталога и настроек, поэтому текст остаётся
 * живым: сменилась цена — обновилось и предложение, без правки кода.
 */
import type { Tokens } from './content';
import type { CategoryId, Equipment, SiteSettings } from './types';

/** Русское склонение по числу: 1 вид / 2 вида / 5 видов */
export function pluralize(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const tail = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (tail > 1 && tail < 5) return forms[1];
  if (tail === 1) return forms[0];
  return forms[2];
}

/** Счётные слова по категориям: в каталоге перечислены модели, а не единицы */
const COUNT_WORD: Record<string, [string, string, string]> = {
  generator: ['вид', 'вида', 'видов'],
  pes: ['вид', 'вида', 'видов'],
  compressor: ['вид', 'вида', 'видов'],
  'compressor-shift': ['вид', 'вида', 'видов'],
  manipulator: ['вид', 'вида', 'видов'],
  used: ['единица', 'единицы', 'единиц'],
};

/** Единица измерения по категории */
export function unitFor(category: string): string {
  switch (category) {
    case 'compressor':
    case 'compressor-shift':
      return 'м³/мин';
    case 'manipulator':
      return 'т';
    default:
      return 'кВт';
  }
}

/** Единица цены берётся из данных, а не из списка категорий */
export function priceUnit(items: Equipment[]): { short: string; long: string } {
  const unit = items.find((i) => i.price?.unit)?.price?.unit ?? '/сутки';
  if (unit.includes('смена')) {
    return { short: '/смена', long: 'за смену 8 часов' };
  }
  return { short: '/сутки', long: 'в сутки' };
}

/** «от 8 до 800 кВт» */
export function powerRange(items: Equipment[], category: string): string {
  const powers = items.map((i) => i.power).filter((v): v is number => v != null);
  if (!powers.length) return '';
  const unit = unitFor(category);
  const min = Math.min(...powers);
  const max = Math.max(...powers);
  return min === max ? `${min} ${unit}` : `от ${min} до ${max} ${unit}`;
}

/** Минимальная цена в каталоге: «2 000» */
export function minPriceOf(items: Equipment[]): number | null {
  const prices = items
    .map((i) => i.price?.value)
    .filter((v): v is number => typeof v === 'number' && v > 0);
  return prices.length ? Math.min(...prices) : null;
}

/**
 * Общие значения для всех страниц: реквизиты и правила компании.
 */
export function baseTokens(settings: SiteSettings, year = new Date().getFullYear()): Tokens {
  return {
    company: settings.company,
    legalName: settings.legalName,
    phone: settings.phone,
    email: settings.email,
    address: settings.address,
    workingHours: settings.workingHours,
    fleetMW: settings.fleetMW,
    deliveryHours: settings.deliveryHours,
    discountFromDays: settings.discountFromDays,
    discountPercent: settings.discountPercent,
    foundedYear: settings.foundedYear,
    years: year - settings.foundedYear,
    year,
  };
}

/**
 * Значения каталога для страницы категории.
 */
export function catalogTokens(
  items: Equipment[],
  category: string,
  settings: SiteSettings
): Tokens {
  const count = items.length;
  const min = minPriceOf(items);
  const pu = priceUnit(items);
  const brands = [...new Set(items.map((i) => i.brand).filter(Boolean))] as string[];

  return {
    ...baseTokens(settings),
    count,
    models: count,
    countWord: pluralize(count, COUNT_WORD[category] ?? COUNT_WORD.generator),
    modelWord: pluralize(count, ['модель', 'модели', 'моделей']),
    powerRange: powerRange(items, category),
    minPrice: min == null ? '' : formatNumber(min),
    priceUnit: pu.short,
    priceLong: pu.long,
    delivery: `от ${settings.deliveryHours} часов`,
    brands: brands.join(', '),
  };
}

/**
 * Значения каталога для главной страницы: по генераторам.
 */
export function homeTokens(
  generators: Equipment[],
  settings: SiteSettings
): Tokens {
  const count = generators.length;
  const min = minPriceOf(generators);
  const pu = priceUnit(generators);
  const brands = [...new Set(generators.map((i) => i.brand).filter(Boolean))] as string[];

  return {
    ...baseTokens(settings),
    count,
    models: count,
    countWord: pluralize(count, COUNT_WORD.generator),
    modelWord: pluralize(count, ['модель', 'модели', 'моделей']),
    minPrice: min == null ? '' : formatNumber(min),
    priceUnit: pu.short,
    priceLong: pu.long,
    delivery: `от ${settings.deliveryHours} часов`,
    brands: brands.join(', '),
  };
}

/** 2000 → «2 000» */
export function formatNumber(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Единица измерения категории по ключу */
export function categoryUnit(category: CategoryId | string): string {
  return unitFor(category);
}
