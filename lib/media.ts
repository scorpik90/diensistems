/**
 * Пути к оптимизированным изображениям.
 *
 * Логика одна на все страницы: путь выводится из данных CMS,
 * а не из порядка элементов в массиве. Иначе при сортировке
 * карточки теряли бы фотографии друг друга.
 */
import type { CaseStudy, Equipment } from './types';

/**
 * Папка с картинками позиции каталога.
 *
 * Путь хранится в поле image — это «eq/<n>», где n — номер папки
 * в public/images/eq/. Фото перенесены со старого сайта миграцией
 * и пережаты в три формата (jpg/webp/avif).
 *
 * Если у позиции фото нет (например, редактор ещё не загрузил
 * снимок) — возвращается null, компонент рисует заглушку.
 */
export function equipmentImageDir(
  e: Pick<Equipment, 'category' | 'power' | 'image'>
): string | null {
  const explicit = e.image?.match(/^(legacy|used|eq)\/\d+/);
  return explicit ? explicit[0] : null;
}

/**
 * Папка с картинкой кейса.
 * В CMS хранится legacy-путь вида «37/dscn0438_small.jpg»,
 * оптимизированные файлы лежат в /images/case/<id>/.
 */
export function caseImageDir(c: Pick<CaseStudy, 'image'>): string | null {
  if (!c.image) return null;
  const id = c.image.split('/')[0].trim();
  return /^\d+$/.test(id) ? `case/${id}` : null;
}

/**
 * Ширина, под которой лежат оптимизированные фото кейсов.
 * На боевом сайте исходники всего 267×200 px — это весь доступный размер.
 */
export const CASE_IMAGE_WIDTH = 267;

/** Ширина оптимизированной картинки техники */
export const EQUIPMENT_IMAGE_WIDTH = 400;
