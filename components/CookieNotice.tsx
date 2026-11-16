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
 */
export default function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!readConsent()) {
      /* Небольшая задержка, чтобы не перехватывать внимание сразу */
      const t = setTimeout(() => setVisible(true), 900);
      return () => clearTimeout(t);
    }
  }, []);

  const decide = (level: ConsentLevel) => {
    writeConsent(level);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="cookie" role="dialog" aria-live="polite" aria-label="Уведомление о файлах cookie">
      <div className="cookie__inner">
        <div className="cookie__text">
          <p className="cookie__title">Мы используем файлы cookie</p>
          <p className="cookie__body">
            Cookie помогают сайту работать корректно и понимать, какие разделы
            вам полезны. Продолжая просмотр, вы соглашаетесь с их
            использованием. Выбор можно изменить в любой момент.
          </p>
          <Link className="cookie__policy" href="/politika-obrabotki-personalnyh-dannyh">
            Политика обработки персональных данных
          </Link>
        </div>

        <div className="cookie__actions">
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => decide('all')}
          >
            <IconCheck className="btn__icon" />
            Принять все
          </button>
          <button
            type="button"
            className="btn btn--outline btn--sm"
            onClick={() => decide('necessary')}
          >
            Только необходимые
          </button>
        </div>
      </div>
    </div>
  );
}
