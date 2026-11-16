/**
 * Изображения сайта.
 *
 * Все снимки лежат в медиатеке Strapi — сайт не знает ни одного пути
 * к файлу в репозитории. Компонент получает объект CmsImage и подставляет
 * srcset из оригинала и производных размеров, которые Strapi создаёт
 * при загрузке (thumbnail / small / medium / large).
 */
import type { CmsImage } from './types';

/**
 * Набор вариантов изображения для srcset.
 *
 * Strapi при загрузке создаёт уменьшенные копии (thumbnail / small /
 * medium / large) в формате оригинала. Мы перечисляем их с дескрипторами
 * ширины — браузер сам выбирает подходящий под экран и плотность пикселей.
 */
export function buildSrcSet(image: CmsImage | null): string {
  if (!image?.url) return '';
  const formats = image.formats ?? {};
  const seen = new Set<string>();
  const parts: string[] = [];

  for (const key of ['thumbnail', 'small', 'medium', 'large'] as const) {
    const f = formats[key];
    if (!f?.url || !f.width || seen.has(f.url)) continue;
    seen.add(f.url);
    parts.push(`${f.url} ${f.width}w`);
  }

  if (image.width && !seen.has(image.url)) {
    parts.push(`${image.url} ${image.width}w`);
  }

  return parts.join(', ');
}

/** Оригинал изображения и его размеры */
export function imageInfo(image: CmsImage | null): {
  src: string;
  width: number;
  height: number;
  alt: string;
} {
  return {
    src: image?.url ?? '',
    width: image?.width ?? 0,
    height: image?.height ?? 0,
    alt: image?.alternativeText ?? '',
  };
}

/**
 * Публичный адрес CMS — для ссылок на медиатеку в текстах.
 *
 * В текстах статей и страниц пути хранятся относительными
 * («/uploads/body_0_xxx.jpg»), чтобы не зависеть от окружения.
 * Здесь к ним подставляется адрес, доступный браузеру посетителя.
 */
export function cmsMediaBase(): string {
  const pub = process.env.CMS_PUBLIC_URL ?? process.env.STRAPI_URL ?? '';
  return pub.replace(/\/$/, '');
}

/**
 * Подстановка публичного адреса CMS в HTML-текст.
 *
 * Внутри текстов остаются относительные пути к файлам медиатеки —
 * они превращаются в абсолютные только здесь, при рендере.
 */
export function withCmsMedia(html: string): string {
  if (!html) return html;
  const base = cmsMediaBase();
  if (!base) return html;
  return html.replace(/(src|href)="\/uploads\//g, `$1="${base}/uploads/`);
}

/**
 * Ширина, под которой лежат оптимизированные фото кейсов.
 * На боевом сайте исходники всего 267×200 px — это весь доступный размер.
 */
export const CASE_IMAGE_WIDTH = 267;

/** Ширина оптимизированной картинки техники */
export const EQUIPMENT_IMAGE_WIDTH = 400;
