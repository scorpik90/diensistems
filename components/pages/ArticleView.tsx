import Link from 'next/link';
import { getCMS } from '@/lib/cms';
import { breadcrumbJsonLd, jsonLd } from '@/lib/seo';
import { sanitizeHtml } from '@/lib/sanitize';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import { IconArrow } from '@/components/icons';
import type { Article, SiteSettings } from '@/lib/types';

/** Рендер статьи базы знаний. */
export default async function ArticleView({
  article,
  settings,
}: {
  article: Article;
  settings: SiteSettings;
}) {
  const more = (await getCMS().getArticles()).filter((a) => a.slug !== article.slug).slice(0, 4);

  return (
    <>
      <SiteHeader settings={settings} active="/poleznoe" />

      <main id="main">
        <article className="section section--tight">
          <div className="container article">
            <nav aria-label="Хлебные крошки">
              <ul className="crumbs">
                <li><Link href="/">Главная</Link></li>
                <li aria-hidden="true">/</li>
                <li><Link href="/poleznoe">Полезное</Link></li>
                <li aria-hidden="true">/</li>
                <li aria-current="page">{article.title.slice(0, 50)}</li>
              </ul>
            </nav>

            <h1 style={{ fontSize: 'clamp(1.6rem, 1.2rem + 1.8vw, 2.4rem)' }}>{article.title}</h1>

            <div
              className="prose legacy-content"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(article.bodyHtml) }}
            />

            <div className="article__cta">
              <Link className="btn btn--lg" href="/#lead">
                Подобрать генератор
              </Link>
              <Link className="btn btn--outline btn--lg" href="/arendageneratorov">
                Каталог моделей
                <IconArrow className="btn__icon" />
              </Link>
            </div>
          </div>
        </article>

        <section className="section section--card">
          <div className="container">
            <div className="head">
              <span className="head__eyebrow">Читайте также</span>
              <h2>Другие материалы</h2>
            </div>
            <div className="articles">
              {more.map((a) => (
                <Link className="article-card" href={`/${a.slug}`} key={a.slug}>
                  <h3>{a.title}</h3>
                  <span className="case__link">
                    Читать
                    <IconArrow />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter settings={settings} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            breadcrumbJsonLd([
              { name: 'Главная', url: '/' },
              { name: 'Полезное', url: '/poleznoe' },
              { name: article.title, url: `/${article.slug}` },
            ])
          ),
        }}
      />
    </>
  );
}
