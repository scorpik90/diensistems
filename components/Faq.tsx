'use client';

/** FAQ-аккордеон — «островок». Данные приходят с сервера из CMS. */
import { useState } from 'react';
import { IconPlus } from './icons';

export interface FaqItem {
  q: string;
  a: string;
}

export default function Faq({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="faq">
      {items.map((f, i) => (
        <div className="faq__item" key={f.q} data-open={String(open === i)}>
          <button
            className="faq__q"
            type="button"
            aria-expanded={open === i}
            onClick={() => setOpen(open === i ? null : i)}
          >
            {f.q}
            <span className="faq__ico" aria-hidden="true">
              <IconPlus />
            </span>
          </button>
          <div className="faq__a" style={open === i ? { maxHeight: 'none' } : undefined}>
            <div className="faq__a-inner">{f.a}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
