import Link from 'next/link';
import { getCMS } from '@/lib/cms';
import { breadcrumbJsonLd, jsonLd } from '@/lib/seo';
import { sanitizeHtml } from '@/lib/sanitize';
import { withCmsMedia } from '@/lib/media';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import { IconArrow } from '@/components/icons';
import type { Content } from '@/lib/content';
import { baseTokens } from '@/lib/tokens';
import type { Article, SiteSettings } from '@/lib/types';

/** Рендер статьи базы знаний. */
export default async function ArticleView({
  article,
  settings,
  content,
}: {
  article: Article;
  settings: SiteSettings;
  content: Content;
}) {
  const more = (await getCMS().getArticles()).filter((a) => a.slug !== article.slug).slice(0, 4);

  const tokens = baseTokens(settings);
  const a = content.o('articles.main', tokens);
  const crumbHome = content.s('global.breadcrumbHome', 'text', tokens) || 'Главная';

  return (
    <>
      <SiteHeader settings={settings} content={content} tokens={tokens} active="/poleznoe" />

      <main id="main">
        <article className="section section--tight">
          <div className="container article">
            <nav aria-label="Хлебные крошки">
              <ul className="crumbs">
                <li><Link href="/">{crumbHome}</Link></li>
                <li aria-hidden="true">/</li>
                <li><Link href="/poleznoe">{a.breadcrumb as string}</Link></li>
                <li aria-hidden="true">/</li>
                <li aria-current="page">{article.title.slice(0, 50)}</li>
              </ul>
            </nav>

            <h1 style={{ fontSize: 'clamp(1.6rem, 1.2rem + 1.8vw, 2.4rem)' }}>{article.title}</h1>

            <div
              className="prose legacy-content"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(withCmsMedia(article.bodyHtml)) }}
            />

            <div className="article__cta">
              <Link className="btn btn--lg" href="/#lead">
                {a.btnCalc as string}
              </Link>
              <Link className="btn btn--outline btn--lg" href="/arendageneratorov">
                {a.btnCatalog as string}
                <IconArrow className="btn__icon" />
              </Link>
            </div>
          </div>
        </article>

        <section className="section section--card">
          <div className="container">
            <div className="head">
              <span className="head__eyebrow">{a.eyebrowMore as string}</span>
              <h2>{a.h2More as string}</h2>
            </div>
            <div className="articles">
              {more.map((m) => (
                <Link className="article-card" href={`/${m.slug}`} key={m.slug}>
                  <h3>{m.title}</h3>
                  <span className="case__link">
                    {a.cta as string}
                    <IconArrow />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter settings={settings} content={content} tokens={tokens} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            breadcrumbJsonLd([
              { name: crumbHome, url: '/' },
              { name: a.breadcrumb as string, url: '/poleznoe' },
              { name: article.title, url: `/${article.slug}` },
            ])
          ),
        }}
      />
    </>
  );
}
