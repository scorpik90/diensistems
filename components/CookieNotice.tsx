'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { readConsent, writeConsent, type ConsentLevel } from '@/lib/consent';
import { IconCheck } from '@/components/icons';

/**
 * Уведомление о cookie.
 *
 * Показывается один раз — выбор сохраняется в localStorage на год.
 * Ссылки ведут в раздел «Файлы cookie» политики обработки
 * персональных данных.
 *
 * Подписи — из CMS (блок «cookie.main»).
 */
export default function CookieNotice({
  labels = {},
  policyUrl = '/politika-obrabotki-personalnyh-dannyh',
}: {
  labels?: Record<string, string>;
  policyUrl?: string;
}) {
  const [visible, setVisible] = useState(false);

  const t = (key: string, fallback: string) => labels?.[key] || fallback;

  useEffect(() => {
    if (!readConsent()) {
      /* Небольшая задержка, чтобы не перехватывать внимание сразу */
      const timer = setTimeout(() => setVisible(true), 900);
      return () => clearTimeout(timer);
    }
  }, []);

  const decide = (level: ConsentLevel) => {
    writeConsent(level);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="cookie"
      role="dialog"
      aria-live="polite"
      aria-label={t('ariaLabel', 'Уведомление о файлах cookie')}
    >
      <div className="cookie__inner">
        <div className="cookie__text">
          <p className="cookie__title">{t('title', 'Мы используем файлы cookie')}</p>
          <p className="cookie__body">
            {t(
              'text',
              'Cookie помогают сайту работать корректно и понимать, какие разделы вам полезны. ' +
                'Продолжая просмотр, вы соглашаетесь с их использованием. ' +
                'Выбор можно изменить в любой момент.'
            )}
          </p>
          <Link className="cookie__policy" href={policyUrl}>
            {t('policyLabel', 'Политика обработки персональных данных')}
          </Link>
        </div>

        <div className="cookie__actions">
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => decide('all')}
          >
            <IconCheck className="btn__icon" />
            {t('btnAccept', 'Принять все')}
          </button>
          <button
            type="button"
            className="btn btn--outline btn--sm"
            onClick={() => decide('necessary')}
          >
            {t('btnNecessary', 'Только необходимые')}
          </button>
        </div>
      </div>
    </div>
  );
}
