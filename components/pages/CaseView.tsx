import Link from 'next/link';
import { getCMS } from '@/lib/cms';
import { breadcrumbJsonLd, jsonLd } from '@/lib/seo';
import { sanitizeHtml } from '@/lib/sanitize';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import { IconArrow } from '@/components/icons';
import MediaPlaceholder from '@/components/MediaPlaceholder';
import { CASE_IMAGE_WIDTH, caseImageDir } from '@/lib/media';
import type { CaseStudy, SiteSettings } from '@/lib/types';

/** Рендер кейса — реального объекта. */
export default async function CaseView({
  item,
  settings,
}: {
  item: CaseStudy;
  settings: SiteSettings;
}) {
  const others = (await getCMS().getCases()).filter((c) => c.slug !== item.slug).slice(0, 3);
  const dir = caseImageDir(item);

  return (
    <>
      <SiteHeader settings={settings} active="/nashiobekty" />

      <main id="main">
        <article className="section section--tight">
          <div className="container">
            <nav aria-label="Хлебные крошки">
              <ul className="crumbs">
                <li><Link href="/">Главная</Link></li>
                <li aria-hidden="true">/</li>
                <li><Link href="/nashiobekty">Наши объекты</Link></li>
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

            {/* Фотография объекта — из legacy-каталога */}
            {dir && (
              <figure className="case__shot">
                <picture>
                  <source type="image/avif" srcSet={`/images/${dir}/267.avif`} />
                  <source type="image/webp" srcSet={`/images/${dir}/267.webp`} />
                  <img
                    src={`/images/${dir}/267.jpg`}
                    alt={item.title}
                    width={400}
                    height={300}
                    fetchPriority="high"
                    decoding="async"
                  />
                </picture>
              </figure>
            )}

            {item.bodyHtml && (
              <div
                className="prose legacy-content"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.bodyHtml) }}
              />
            )}
          </div>
        </article>

        <section className="section section--card">
          <div className="container">
            <div className="head">
              <span className="head__eyebrow">Другие объекты</span>
              <h2>Смотрите также</h2>
            </div>
            <div className="cases">
              {others.map((c) => {
                const dir = caseImageDir(c);
                return (
                <Link className="case" href={`/${c.slug}`} key={c.slug}>
                  <div className="case__media">
                    {dir ? (
                      <picture>
                        <source type="image/avif" srcSet={`/images/${dir}/${CASE_IMAGE_WIDTH}.avif`} />
                        <source type="image/webp" srcSet={`/images/${dir}/${CASE_IMAGE_WIDTH}.webp`} />
                        <img
                          src={`/images/${dir}/${CASE_IMAGE_WIDTH}.jpg`}
                          alt={c.title}
                          width={CASE_IMAGE_WIDTH}
                          height={200}
                          loading="lazy"
                          decoding="async"
                        />
                      </picture>
                    ) : (
                      <MediaPlaceholder kind="case" title={c.title} subtitle="Фото объекта нет" />
                    )}
                  </div>
                  <div className="case__overlay" />
                  <div className="case__body">
                    {c.kW && <span className="case__meta">{c.kW} кВт</span>}
                    <h3 className="case__title">{c.title}</h3>
                    <span className="case__link">
                      Смотреть объект
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

      <SiteFooter settings={settings} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            breadcrumbJsonLd([
              { name: 'Главная', url: '/' },
              { name: 'Наши объекты', url: '/nashiobekty' },
              { name: item.title, url: `/${item.slug}` },
            ])
          ),
        }}
      />
    </>
  );
}
