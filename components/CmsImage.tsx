/**
 * Изображение из медиатеки Strapi.
 *
 * Все фотографии сайта лежат в CMS — компонент получает готовый объект
 * и подставляет srcset с производными размерами, которые Strapi создаёт
 * при загрузке. Браузер сам выбирает подходящий файл.
 */
import { buildSrcSet, imageInfo } from '@/lib/media';
import type { CmsImage } from '@/lib/types';

export default function CmsImage({
  image,
  alt,
  width,
  height,
  sizes,
  className,
  priority = false,
  style,
}: {
  image: CmsImage | null | undefined;
  /** alt-текст; если пусто — берётся из медиатеки */
  alt?: string;
  width?: number;
  height?: number;
  sizes?: string;
  className?: string;
  priority?: boolean;
  style?: React.CSSProperties;
}) {
  if (!image?.url) return null;

  const info = imageInfo(image);
  const w = width ?? info.width;
  const h = height ?? info.height;
  const altText = alt ?? info.alt ?? '';

  return (
    <img
      src={info.src}
      srcSet={buildSrcSet(image)}
      sizes={sizes}
      alt={altText}
      width={w || undefined}
      height={h || undefined}
      className={className}
      loading={priority ? undefined : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      style={style}
    />
  );
}
