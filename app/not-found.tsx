import Link from 'next/link';
import { getCMS, getContent } from '@/lib/cms';

/**
 * Страница «404 — такого адреса нет».
 *
 * Тексты — из CMS (блок «errors.main»), телефон — из настроек сайта.
 */
export default async function NotFound() {
  const cms = getCMS();
  const [settings, content] = await Promise.all([cms.getSettings(), getContent()]);
  const e = content.o('errors.main');

  return (
    <main
      id="main"
      style={{
        minHeight: '70vh',
        display: 'grid',
        placeItems: 'center',
        textAlign: 'center',
        padding: '48px 24px',
      }}
    >
      <div style={{ maxWidth: 520 }}>
        <p style={{ fontSize: '4rem', fontWeight: 800, color: 'var(--brand)', lineHeight: 1, margin: 0 }}>
          {(e.code as string) || '404'}
        </p>
        <h1 style={{ fontSize: '1.75rem', margin: '16px 0 12px' }}>
          {(e.title as string) || 'Такой страницы нет'}
        </h1>
        <p style={{ color: 'var(--slate-600)', marginBottom: 24 }}>
          {e.text as string}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link className="btn" href="/arendageneratorov">
            {(e.btn as string) || 'В каталог'}
          </Link>
          <a className="btn btn--outline" href={`tel:${settings.phoneRaw}`}>
            {settings.phone}
          </a>
        </div>
      </div>
    </main>
  );
}
