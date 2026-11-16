/**
 * Фирменный знак компании «ДИЭН-Системс».
 *
 * Это не нарисованный нами знак, а оригинальный логотип владельца
 * (шестерня с «Д»), подготовленный скриптом scripts/prepare-brand.mjs:
 * белый фон убран, лишние поля обрезаны, отрисованы в PNG/WebP/AVIF.
 *
 * Сам файл лежит в медиатеке Strapi — приходит в поле logoMark
 * настроек сайта.
 */
import CmsImage from './CmsImage';
import type { CmsImage as CmsImageType } from '@/lib/types';

export default function BrandMark({
  image,
  className,
  width = 48,
  height = 44,
}: {
  image?: CmsImageType | null;
  className?: string;
  width?: number;
  height?: number;
}) {
  return <CmsImage image={image} alt="" width={width} height={height} className={className} />;
}
