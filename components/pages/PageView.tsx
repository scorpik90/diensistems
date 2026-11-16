import Link from 'next/link';
import { getCMS } from '@/lib/cms';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import { IconArrow, IconCheck } from '@/components/icons';
import MediaPlaceholder from '@/components/MediaPlaceholder';
import CatalogGrid from '@/components/CatalogGrid';
import PriceTableView from '@/components/pages/PriceTableView';
import { CASE_IMAGE_WIDTH, caseImageDir, equipmentImageDir } from '@/lib/media';
import { categoryContent } from '@/lib/category-content';
import { jsonLd, SITE_URL } from '@/lib/seo';
import { sanitizeHtml } from '@/lib/sanitize';
import type { SiteSettings, StaticPage } from '@/lib/types';

/**
 * Универсальная страница из CMS.
 *   kind 'catalog'  → сетка позиций категории
 *   kind 'price'    → таблицы прайс-листа
 *   kind 'cases'    → индекс кейсов
 *   kind 'articles' → индекс статей
 *   kind 'static'   → текст
 */
export default async function PageView({
  page,
  settings,
}: {
  page: StaticPage;
  settings: SiteSettings;
}) {
  const cms = getCMS();
  const items = page.category ? await cms.getEquipmentByCategory(page.category) : [];
  const priceTables = page.kind === 'price' ? await cms.getPriceTables() : [];
  const cases = page.kind === 'cases' ? await cms.getCases() : [];
  const articles = page.kind === 'articles' ? await cms.getArticles() : [];

  /* Контент для SEO/GEO: краткий ответ, факты, вопросы */
  const cat = categoryContent(page.kind, page.slug, page.category, items);

  return (
    <>
      <SiteHeader settings={settings} active={page.slug} />

      <main id="main">
        <section className="section section--tight">
          <div className="container">
            <nav aria-label="Хлебные крошки">
              <ul className="crumbs">
                <li><Link href="/">Главная</Link></li>
                <li aria-hidden="true">/</li>
                <li aria-current="page">{page.title}</li>
              </ul>
            </nav>

            <div className="head">
              <span className="head__eyebrow">
                {page.kind === 'catalog'
                  ? 'Каталог'
                  : page.kind === 'price'
                    ? 'Прайс-лист'
                    : page.kind === 'cases'
                      ? 'Объекты'
                      : page.kind === 'articles'
                        ? 'База знаний'
                        : 'Раздел'}
              </span>
              <h1 style={{ fontSize: 'clamp(1.75rem, 1.2rem + 2vw, 2.75rem)' }}>{page.title}</h1>
              {page.excerpt && <p>{page.excerpt}</p>}
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

                <h2 className="section__h2">Каталог моделей</h2>
                <CatalogGrid equipment={items} category={page.category} />

                {/* Что входит в аренду — с конкретикой по условиям */}
                <h2 className="section__h2">Что входит в стоимость</h2>
                <ul className="answer__includes">
                  {[
                    'Сама станция и регламентное ТО',
                    'Ёмкость для топлива',
                    'Подключение к силовому кабелю заказчика',
                    'Обучение персонала',
                    'Резервная машина на базе и подмена при нештатной ситуации',
                    'Выездная поддержка 24/7',
                  ].map((t) => (
                    <li key={t}>
                      <IconCheck />
                      {t}
                    </li>
                  ))}
                </ul>

                {/* Частые вопросы — источник быстрых ответов */}
                {cat && cat.faq.length > 0 && (
                  <>
                    <h2 className="section__h2">Частые вопросы</h2>
                    <div className="faq">
                      {cat.faq.map((f) => (
                        <details className="faq__item" key={f.q}>
                          <summary className="faq__q">{f.q}</summary>
                          <div className="faq__a">
                            <p>{f.a}</p>
                          </div>
                        </details>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            {/* ─── Прайс-лист ─── */}
            {page.kind === 'price' && (
              <>
                <h2 className="section__h2">Цены на аренду техники</h2>
                {priceTables.map((t) => (
                  <PriceTableView table={t} key={t.index} />
                ))}
              </>
            )}

            {/* ─── Кейсы ─── */}
            {page.kind === 'cases' && (
              <>
                <h2 className="section__h2">Объекты и выполненные работы</h2>
                <div className="cases">
                {cases.map((c) => {
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
              </>
            )}

            {/* ─── Статьи ─── */}
            {page.kind === 'articles' && (
              <div className="articles">
                {articles.map((a) => (
                  <Link className="article-card" href={`/${a.slug}`} key={a.slug}>
                    <h2>{a.title}</h2>
                    <span className="case__link">
                      Читать
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
                      ? 'Цены на аренду техники'
                      : page.kind === 'cases'
                        ? 'Объекты и выполненные работы'
                        : page.kind === 'articles'
                          ? 'Статьи и разборы'
                          : page.slug === 'dostavka'
                            ? 'Стоимость и сроки доставки'
                            : page.slug === 'prodazhatopliva'
                              ? 'Дизельное топливо в аренду'
                              : 'Шумозащитное ограждение'}
                  </h2>
                )}
                <div
                  className="prose legacy-content"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(page.bodyHtml) }}
                />
              </>
            )}

            {/* Кнопка подбора есть только в каталогах аренды.
                В разделе продажи б/у техники расчёт аренды неуместен. */}
            {page.kind === 'catalog' && page.category !== 'used' && (
              <p style={{ marginTop: 28 }}>
                <Link className="btn btn--outline" href="/#lead">
                  Подобрать и рассчитать
                  <IconArrow className="btn__icon" />
                </Link>
              </p>
            )}
          </div>
        </section>
      </main>

      <SiteFooter settings={settings} />

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
                  { '@type': 'ListItem', position: 1, name: 'Главная', item: SITE_URL },
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
