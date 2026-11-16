'use client';

import { useEffect, useState } from 'react';
import { thirdPartyAllowed } from '@/lib/consent';

/**
 * Живой бейдж рейтинга Яндекс.Карт.
 *
 * Яндекс — сторонний сервис: его виджет ставит собственные cookie.
 * Пока пользователь не выразил согласие на обработку технических
 * данных, виджет не загружается — вместо него показывается
 * ссылка на страницу организации.
 */
export default function YandexRatingBadge({ orgId }: { orgId: string }) {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    setAllowed(thirdPartyAllowed());

    /* Пользователь может принять cookie, не перезагружая страницу */
    const onStorage = () => setAllowed(thirdPartyAllowed());
    window.addEventListener('storage', onStorage);
    const t = setInterval(() => {
      const now = thirdPartyAllowed();
      setAllowed((prev) => (prev === now ? prev : now));
    }, 1000);

    return () => {
      window.removeEventListener('storage', onStorage);
      clearInterval(t);
    };
  }, []);

  if (!allowed) {
    return (
      <span className="rating__badge rating__badge--pending">
        <a
          href={`https://yandex.ru/maps/org/dien_sistems/${orgId}/`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Рейтинг на Яндекс.Картах
        </a>
      </span>
    );
  }

  return (
    <span className="rating__badge">
      <iframe
        src={`https://yandex.ru/sprav/widget/rating-badge/${orgId}?type=rating`}
        width="150"
        height={50}
        frameBorder={0}
        loading="lazy"
        title="Рейтинг компании на Яндекс.Картах"
      />
    </span>
  );
}
