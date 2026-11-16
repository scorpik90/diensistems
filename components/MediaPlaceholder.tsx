/**
 * Плейсхолдер изображения.
 *
 * Нужен там, где у позиции нет фотографии: часть ПЭС, компрессоров и
 * манипуляторов на боевом сайте просто не имеет снимков. Раньше там
 * появлялся битый значок браузера — теперь аккуратная заглушка в стиле
 * сайта (силуэт техники + название позиции).
 */
import type { ReactNode } from 'react';

function GlyphProduct() {
  return (
    <svg className="ph__icon" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {/* корпус ДГУ */}
      <rect x="5" y="17" width="54" height="32" rx="4" />
      {/* панель управления */}
      <rect x="11" y="23" width="17" height="20" rx="2" />
      <circle cx="19.5" cy="29" r="2.4" />
      <path d="M14 36h11" />
      {/* вентиляционные жалюзи */}
      <rect x="34" y="24" width="19" height="3" rx="1.5" />
      <rect x="34" y="31" width="19" height="3" rx="1.5" />
      <rect x="34" y="38" width="19" height="3" rx="1.5" />
      {/* опоры */}
      <path d="M14 49v5M50 49v5" />
      {/* разряд */}
      <path d="M44 10l-5 8h4l-3 7 8-9h-4z" />
    </svg>
  );
}

function GlyphCase() {
  return (
    <svg className="ph__icon" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {/* площадка */}
      <path d="M8 52h48" />
      {/* корпус сооружения */}
      <path d="M18 52V29l14-11 14 11v23" />
      {/* проём */}
      <path d="M27 52V39h10v13" />
      {/* стрела крана */}
      <path d="M8 27h9M47 27h9" />
      <path d="M32 18V9" />
      <path d="M26 9h12" />
    </svg>
  );
}

export default function MediaPlaceholder({
  kind = 'product',
  title,
  subtitle,
}: {
  kind?: 'product' | 'case';
  title?: string | null;
  subtitle?: string | null;
}) {
  const glyph: ReactNode = kind === 'case' ? <GlyphCase /> : <GlyphProduct />;

  return (
    <div
      className={`ph ph--${kind}`}
      role="img"
      aria-label={title ? `${title} — фотография отсутствует` : 'Фотография отсутствует'}
    >
      {glyph}
      {title && <span className="ph__title">{title}</span>}
      {subtitle && <span className="ph__sub">{subtitle}</span>}
    </div>
  );
}
