/**
 * Фирменный знак компании «ДИЭН-Системс».
 *
 * Это не нарисованный нами знак, а оригинальный логотип владельца
 * (шестерня с «Д»), подготовленный скриптом scripts/prepare-brand.mjs:
 * белый фон убран, лишние поля обрезаны, отрисованы в PNG/WebP/AVIF.
 *
 * Оригинал: i.webp → public/images/brand/mark.*
 */
export default function BrandMark({
  className,
  width = 48,
  height = 44,
}: {
  className?: string;
  width?: number;
  height?: number;
}) {
  return (
    <picture className={className}>
      <source type="image/avif" srcSet="/images/brand/mark.avif" />
      <source type="image/webp" srcSet="/images/brand/mark.webp" />
      <img
        src="/images/brand/mark.png"
        alt=""
        width={width}
        height={height}
        decoding="async"
      />
    </picture>
  );
}
