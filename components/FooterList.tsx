'use client';

import { useState } from 'react';
import Link from 'next/link';

/**
 * Сворачиваемый блок подвала.
 *
 * На десктопе это обычный список ссылок с заголовком.
 * На узких экранах заголовок становится кнопкой: список свёрнут
 * по умолчанию и разворачивается по клику — иначе блоки «Услуги»
 * и «Компания» занимали пол-экрана и отодвигали контакты вниз.
 */
export default function FooterList({
  title,
  items,
  defaultOpen = false,
}: {
  title: string;
  items: { href: string; label: string }[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`footer__col${open ? ' is-open' : ''}`}>
      <h4 className="footer__heading">
        <button
          type="button"
          className="footer__toggle"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {title}
          <svg
            className="footer__chev"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </h4>

      <ul className="footer__list">
        {items.map((it) => (
          <li key={it.href}>
            <Link href={it.href}>{it.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
