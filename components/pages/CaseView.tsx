import Link from 'next/link';
import { getCMS } from '@/lib/cms';
import { breadcrumbJsonLd, jsonLd } from '@/lib/seo';
import { sanitizeHtml } from '@/lib/sanitize';
import { withCmsMedia } from '@/lib/media';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import { IconArrow } from '@/components/icons';
import MediaPlaceholder from '@/components/MediaPlaceholder';
import CmsImage from '@/components/CmsImage';
import type { Content } from '@/lib/content';
import { baseTokens } from '@/lib/tokens';
import type { CaseStudy, SiteSettings } from '@/lib/types';

/** Рендер кейса — реального объекта. */
export default async function CaseView({
  item,
  settings,
  content,
}: {
  item: CaseStudy;
  settings: SiteSettings;
  content: Content;
}) {
  const others = (await getCMS().getCases()).filter((c) => c.slug !== item.slug).slice(0, 3);

  const tokens = baseTokens(settings);
  const c = content.o('cases.main', tokens);
  const crumbHome = content.s('global.breadcrumbHome', 'text', tokens) || 'Главная';

  return (
    <>
      <SiteHeader settings={settings} content={content} tokens={tokens} active="/nashiobekty" />

      <main id="main">
        <article className="section section--tight">
          <div className="container">
            <nav aria-label="Хлебные крошки">
              <ul className="crumbs">
                <li><Link href="/">{crumbHome}</Link></li>
                <li aria-hidden="true">/</li>
                <li><Link href="/nashiobekty">{c.breadcrumb as string}</Link></li>
                <li aria-hidden="true">/</li>
                <li aria-current="page">{item.title.slice(0, 40)}</li>
              </ul>
            </nav>

            <h1 style={{ fontSize: 'clamp(1.6rem, 1.2rem + 1.8vw, 2.4rem)' }}>
              {item.title}
            </h1>

            {item.kW && (
              <p style={{ marginBottom: 18 }}>
                <span className="badge badge--info">{item.kW} кВт</span>
              </p>
            )}

            {/* Фотография объекта — из медиатеки Strapi */}
            {item.image && (
              <figure className="case__shot">
                <CmsImage
                  image={item.image}
                  alt={item.imageAlt || item.title}
                  width={400}
                  height={300}
                  priority
                />
              </figure>
            )}

            {item.bodyHtml && (
              <div
                className="prose legacy-content"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(withCmsMedia(item.bodyHtml)) }}
              />
            )}
          </div>
        </article>

        <section className="section section--card">
          <div className="container">
            <div className="head">
              <span className="head__eyebrow">{c.eyebrowMore as string}</span>
              <h2>{c.h2More as string}</h2>
            </div>
            <div className="cases">
              {others.map((o) => {
                return (
                <Link className="case" href={`/${o.slug}`} key={o.slug}>
                  <div className="case__media">
                    {o.image ? (
                      <CmsImage image={o.image} alt={o.imageAlt || o.title} width={400} height={300} />
                    ) : (
                      <MediaPlaceholder
                        kind="case"
                        title={o.title}
                        subtitle={c.placeholder as string}
                      />
                    )}
                  </div>
                  <div className="case__overlay" />
                  <div className="case__body">
                    {o.kW && <span className="case__meta">{o.kW} кВт</span>}
                    <h3 className="case__title">{o.title}</h3>
                    <span className="case__link">
                      {c.cta as string}
                      <IconArrow />
                    </span>
                  </div>
                </Link>
                );
              })}
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
              { name: c.breadcrumb as string, url: '/nashiobekty' },
              { name: item.title, url: `/${item.slug}` },
            ])
          ),
        }}
      />
    </>
  );
}
