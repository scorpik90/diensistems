'use client';

/**
 * Мобильное меню — «островок» (client component).
 * Вся остальная шапка рендерится на сервере и не гидратируется.
 *
 * Панель выносится в портал на <body> по важной причине:
 * шапка липкая и с backdrop-filter, а такой элемент становится
 * containing block для position: fixed. Из-за этого меню с
 * position: fixed растягивалось не на экран, а на высоту шапки
 * (68 px) и не раскрывалось. В портале фиксированное позиционирование
 * считается от окна, и панель всегда поверх всего сайта.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { IconClose, IconMenu } from './icons';

export default function MobileMenu({
  nav,
  tech,
  phone,
  phoneRaw,
  labels,
}: {
  nav: { href: string; label: string }[];
  tech?: { href: string; label: string; note?: string | null }[];
  phone: string;
  phoneRaw: string;
  /** Подписи из CMS */
  labels?: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const t = (key: string, fallback: string) => labels?.[key] || fallback;

  /* Портал можно создать только в браузере */
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    document.body.dataset.scrollLock = open ? 'true' : 'false';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.dataset.scrollLock = 'false';
    };
  }, [open]);

  const panel = (
    <div className="mnav" id="mnav" data-open={String(open)}>
      <div className="mnav__overlay" onClick={() => setOpen(false)} />
      <div
        className="mnav__panel"
        role="dialog"
        aria-modal="true"
        aria-label={t('ariaLabel', 'Меню сайта')}
      >
        <div className="mnav__head">
          <span className="mnav__title">{t('title', 'Меню')}</span>
          <button
            className="mnav__close"
            type="button"
            aria-label={t('closeAria', 'Закрыть меню')}
            onClick={() => setOpen(false)}
          >
            <IconClose />
          </button>
        </div>

        <ul className="mnav__list">
          {nav.map((n) => (
            <li key={n.href}>
              <Link href={n.href} onClick={() => setOpen(false)}>
                {n.label}
                <span aria-hidden="true">›</span>
              </Link>
            </li>
          ))}
        </ul>

        {/* Остальная техника и услуги — отдельным блоком,
            на десктопе они раскрываются по наведению на «Генераторы» */}
        {tech && tech.length > 0 && (
          <>
            <p className="mnav__title" style={{ marginTop: 18 }}>
              {t('techTitle', 'Другая техника и услуги')}
            </p>
            <ul className="mnav__list mnav__list--sub">
              {tech.map((t) => (
                <li key={t.href}>
                  <Link href={t.href} onClick={() => setOpen(false)}>
                    {t.label}
                    <span aria-hidden="true">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="mnav__foot">
          <a className="btn btn--block" href={`tel:${phoneRaw}`}>
            {t('callLabel', `Позвонить ${phone}`)}
          </a>
          <Link className="btn btn--outline btn--block" href="/#lead" onClick={() => setOpen(false)}>
            {t('calcLabel', 'Рассчитать стоимость')}
          </Link>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        className="burger"
        type="button"
        aria-label={t('openAria', 'Открыть меню')}
        aria-expanded={open}
        aria-controls="mnav"
        data-mnav-open
        onClick={() => setOpen(true)}
      >
        <IconMenu />
      </button>

      {/* Панель — в портал на body, чтобы быть поверх всего сайта */}
      {mounted && createPortal(panel, document.body)}
    </>
  );
}
