import Link from 'next/link';

export default function NotFound() {
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
          404
        </p>
        <h1 style={{ fontSize: '1.75rem', margin: '16px 0 12px' }}>
          Такой страницы нет
        </h1>
        <p style={{ color: 'var(--slate-600)', marginBottom: 24 }}>
          Возможно, ссылка устарела. Посмотрите каталог генераторов или позвоните — поможем
          подобрать.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link className="btn" href="/arendageneratorov">
            В каталог
          </Link>
          <a className="btn btn--outline" href="tel:+74955405292">
            +7 (495) 540-52-92
          </a>
        </div>
      </div>
    </main>
  );
}
