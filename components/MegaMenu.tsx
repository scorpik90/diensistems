'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

/**
 * Пункт меню с выпадающим списком.
 *
 * Открывается при наведении мышью и при фокусе с клавиатуры,
 * закрывается по Escape или при уходе курсора. Состояние хранится
 * в React, поэтому у ссылки корректные aria-expanded и aria-haspopup.
 */
export default function MegaMenu({
  label,
  href,
  items,
  active,
}: {
  label: string;
  href: string;
  items: { href: string; label: string; note?: string }[];
  active?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onClick);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const show = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };

  /* Небольшая задержка: чтобы курсор успел доехать до выпадашки */
  const hide = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  return (
    <div
      className="nav__item"
      ref={wrapRef}
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      <Link
        href={href}
        className={`nav__link nav__link--drop${active === href ? ' nav__link--active' : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
        /* Фокус на пункте тоже раскрывает список — для клавиатуры */
        onFocus={show}
        onBlur={(e) => {
          if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) {
            hide();
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            /* Фокус переносим в выпадающий список, но только после
               того, как он появился в DOM (иначе фокус не ставится) */
            requestAnimationFrame(() => {
              wrapRef.current?.querySelector<HTMLAnchorElement>('.nav__drop a')?.focus();
            });
          }
        }}
      >
        {label}
        <svg className="nav__chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </Link>

      <div className="nav__drop" hidden={!open}>
        <ul className="nav__drop-list">
          {items.map((it) => (
            <li key={it.href}>
              <Link href={it.href} onClick={() => setOpen(false)}>
                <span className="nav__drop-title">{it.label}</span>
                {it.note && <span className="nav__drop-note">{it.note}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
