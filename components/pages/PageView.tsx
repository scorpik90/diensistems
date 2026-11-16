import Link from 'next/link';
import { getCMS } from '@/lib/cms';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import { IconArrow, IconCheck } from '@/components/icons';
import MediaPlaceholder from '@/components/MediaPlaceholder';
import CmsImage from '@/components/CmsImage';
import CatalogGrid from '@/components/CatalogGrid';
import Faq from '@/components/Faq';
import PriceTableView from '@/components/pages/PriceTableView';
import { categoryContent } from '@/lib/category-content';
import { sanitizeHtml } from '@/lib/sanitize';
import { withCmsMedia } from '@/lib/media';
import { catalogTokens } from '@/lib/tokens';
import { SITE_URL, jsonLd } from '@/lib/seo';
import type { Content } from '@/lib/content';
import type { SiteSettings, StaticPage } from '@/lib/types';

/**
 * Универсальная страница из CMS.
 *   kind 'catalog'  → сетка позиций категории
 *   kind 'price'    → таблицы прайс-листа
 *   kind 'cases'    → индекс кейсов
 *   kind 'articles' → индекс статей
 *   kind 'static'   → текст
 *
 * Все подписи приходят из CMS (коллекция «Текстовый блок»).
 */
export default async function PageView({
  page,
  settings,
  content,
}: {
  page: StaticPage;
  settings: SiteSettings;
  content: Content;
}) {
  const cms = getCMS();
  const items = page.category ? await cms.getEquipmentByCategory(page.category) : [];
  const priceTables = page.kind === 'price' ? await cms.getPriceTables() : [];
  const cases = page.kind === 'cases' ? await cms.getCases() : [];
  const articles = page.kind === 'articles' ? await cms.getArticles() : [];
  const categories = await cms.getCategories();

  /* Подстановки: числа берутся из каталога этой категории */
  const tokens = page.category
    ? catalogTokens(items, page.category, settings)
    : catalogTokens([], 'generator', settings);

  /* Контент для SEO/GEO: краткий ответ, факты, вопросы */
  const cat = categoryContent(
    page.kind,
    page.slug,
    page.category,
    items,
    categories.find((c) => c.id === page.category) ?? null,
    settings,
    tokens
  );

  const b = content.o('catalog.main', tokens);
  const card = content.o('catalog.card', tokens);
  const casesLabels = content.o('cases.main', tokens);
  const articlesLabels = content.o('articles.main', tokens);
  const crumbHome = content.s('global.breadcrumbHome', 'text', tokens) || 'Главная';

  const eyebrow =
    page.kind === 'catalog'
      ? b.eyebrowCatalog
      : page.kind === 'price'
        ? b.eyebrowPrice
        : page.kind === 'cases'
          ? b.eyebrowCases
          : page.kind === 'articles'
            ? b.eyebrowArticles
            : b.eyebrowStatic;

  return (
    <>
      <SiteHeader settings={settings} content={content} tokens={tokens} active={page.slug} />

      <main id="main">
        <section className="section section--tight">
          <div className="container">
            <nav aria-label="Хлебные крошки">
              <ul className="crumbs">
                <li><Link href="/">{crumbHome}</Link></li>
                <li aria-hidden="true">/</li>
                <li aria-current="page">{page.title}</li>
              </ul>
            </nav>

            <div className="head">
              <span className="head__eyebrow">{eyebrow}</span>
              <h1 style={{ fontSize: 'clamp(1.75rem, 1.2rem + 2vw, 2.75rem)' }}>{page.title}</h1>
              {/* На страницах каталогов текст из legacy-описания повторял
                  то, что уже сказано в блоке «краткий ответ» ниже,
                  поэтому здесь он не выводится. */}
              {page.excerpt && page.kind !== 'catalog' && <p>{page.excerpt}</p>}
            </div>

            {/* ─── Каталог ─── */}
            {page.kind === 'catalog' && items.length > 0 && (
              <>
                {/* Краткий ответ + факты.
                    Первыми словами страницы — прямой ответ и конкретные
                    цифры: так выглядит цитирование в генеративной выдаче
                    (ЯндексGPT, Алиса, ChatGPT, Perplexity). */}
                {cat && (
                  <div className="answer">
                    <p className="answer__text">{cat.answer}</p>
                    <dl className="answer__facts">
                      {cat.facts.map((f) => (
                        <div key={f.label}>
                          <dt>{f.label}</dt>
                          <dd>{f.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}

                <h2 className="section__h2">{b.h2Models}</h2>
                <CatalogGrid
                  equipment={items}
                  category={page.category}
                  labels={{
                    badgeHit: card.badgeHit as string,
                    badgeNew: card.badgeNew as string,
                    btnOrder: card.btnOrder as string,
                    btnMore: card.btnMore as string,
                    filterBrandAria: card.filterBrandAria as string,
                    filterRangeAria: card.filterRangeAria as string,
                    allBrands: card.allBrands as string,
                    emptyTitle: card.emptyTitle as string,
                    emptyText: card.emptyText as string,
                    reset: card.reset as string,
                  }}
                />

                {/* Что входит в аренду — с конкретикой по условиям.
                    Состав зависит от тарифа, о чём и говорит сноска. */}
                {cat && cat.includes.length > 0 && (
                  <>
                    <h2 className="section__h2">{b.h2Includes}</h2>
                    <ul className="answer__includes">
                      {cat.includes.map((t) => (
                        <li key={t}>
                          <IconCheck />
                          {t}
                        </li>
                      ))}
                    </ul>
                    {cat.includesNote && <p className="answer__note">{cat.includesNote}</p>}
                  </>
                )}

                {/* Частые вопросы — источник быстрых ответов.
                    Используем тот же аккордеон, что на главной:
                    свои стили сломали бы его оформление. */}
                {cat && cat.faq.length > 0 && (
                  <>
                    <h2 className="section__h2">{b.h2Faq as string}</h2>
                    <Faq items={cat.faq} />
                  </>
                )}
              </>
            )}

            {/* ─── Прайс-лист ─── */}
            {page.kind === 'price' && (
              <>
                <h2 className="section__h2">{b.h2Prices}</h2>
                {priceTables.map((t) => (
                  <PriceTableView table={t} key={t.index} />
                ))}
              </>
            )}

            {/* ─── Кейсы ─── */}
            {page.kind === 'cases' && (
              <>
                <h2 className="section__h2">{b.h2Cases}</h2>
                <div className="cases">
                {cases.map((c) => {
                  return (
                  <Link className="case" href={`/${c.slug}`} key={c.slug}>
                    <div className="case__media">
                      {c.image ? (
                        <CmsImage
                          image={c.image}
                          alt={c.imageAlt || c.title}
                          width={400}
                          height={300}
                        />
                      ) : (
                        <MediaPlaceholder
                          kind="case"
                          title={c.title}
                          subtitle={casesLabels.placeholder as string}
                        />
                      )}
                    </div>
                    <div className="case__overlay" />
                    <div className="case__body">
                      {c.kW && <span className="case__meta">{c.kW} кВт</span>}
                      <h3 className="case__title">{c.title}</h3>
                      <span className="case__link">
                        {casesLabels.cta as string}
                        <IconArrow />
                      </span>
                    </div>
                  </Link>
                  );
                })}
                </div>
              </>
            )}

            {/* ─── Статьи ─── */}
            {page.kind === 'articles' && (
              <div className="articles">
                {articles.map((a) => (
                  <Link className="article-card" href={`/${a.slug}`} key={a.slug}>
                    <h2>{a.title}</h2>
                    <span className="case__link">
                      {articlesLabels.cta as string}
                      <IconArrow />
                    </span>
                  </Link>
                ))}
              </div>
            )}

            {/* ─── Текст ─── */}
            {page.bodyHtml && (
              <>
                {/* Заголовок раздела — нужен для структуры страницы
                    и для «быстрых ответов» поисковиков */}
                {(page.kind === 'price' ||
                  page.kind === 'cases' ||
                  page.kind === 'articles' ||
                  ['dostavka', 'prodazhatopliva', 'dopoborudovanie'].includes(page.slug)) && (
                  <h2 className="section__h2">
                    {page.kind === 'price'
                      ? b.h2Prices
                      : page.kind === 'cases'
                        ? b.h2Cases
                        : page.kind === 'articles'
                          ? b.h2Articles
                          : page.slug === 'dostavka'
                            ? b.h2Delivery
                            : page.slug === 'prodazhatopliva'
                              ? b.h2Fuel
                              : b.h2Noise}
                  </h2>
                )}
                <div
                  className="prose legacy-content"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(withCmsMedia(page.bodyHtml)) }}
                />
              </>
            )}

            {/* Кнопка подбора есть только в каталогах аренды.
                В разделе продажи б/у техники расчёт аренды неуместен. */}
            {page.kind === 'catalog' && page.category !== 'used' && (
              <p style={{ marginTop: 28 }}>
                <Link className="btn btn--outline" href="/#lead">
                  {b.ctaCalc as string}
                  <IconArrow className="btn__icon" />
                </Link>
              </p>
            )}
          </div>
        </section>
      </main>

      <SiteFooter settings={settings} content={content} tokens={tokens} />

      {/* ─── Разметка для поисковиков и ИИ-ответов ─── */}
      {cat && (
        <>
          {/* Список моделей с ценами — из него собираются
              расширенные сниппеты и карусели товаров */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: jsonLd({
                '@context': 'https://schema.org',
                '@type': 'ItemList',
                name: `${page.title} — каталог`,
                numberOfItems: items.length,
                itemListElement: items.slice(0, 30).map((e, i) => ({
                  '@type': 'ListItem',
                  position: i + 1,
                  url: `${SITE_URL}/${e.slug}`,
                  name: e.title,
                })),
              }),
            }}
          />

          {/* FAQPage — источник быстрых ответов */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: jsonLd({
                '@context': 'https://schema.org',
                '@type': 'FAQPage',
                mainEntity: cat.faq.map((f) => ({
                  '@type': 'Question',
                  name: f.q,
                  acceptedAnswer: { '@type': 'Answer', text: f.a },
                })),
              }),
            }}
          />

          {/* Хлебные крошки — показывают структуру раздела */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: jsonLd({
                '@context': 'https://schema.org',
                '@type': 'BreadcrumbList',
                itemListElement: [
                  { '@type': 'ListItem', position: 1, name: crumbHome, item: SITE_URL },
                  {
                    '@type': 'ListItem',
                    position: 2,
                    name: page.title,
                    item: `${SITE_URL}/${page.slug}`,
                  },
                ],
              }),
            }}
          />
        </>
      )}
    </>
  );
}
