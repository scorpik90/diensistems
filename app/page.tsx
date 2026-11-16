import Link from 'next/link';
import { getCMS, getContent } from '@/lib/cms';
import { money } from '@/lib/format';
import { faqJsonLd, jsonLd } from '@/lib/seo';
import { homeTokens, pluralize } from '@/lib/tokens';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import CalcWidget from '@/components/CalcWidget';
import LeadForm from '@/components/LeadForm';
import Faq from '@/components/Faq';
import MediaPlaceholder from '@/components/MediaPlaceholder';
import CmsImage from '@/components/CmsImage';
import YandexRatingBadge from '@/components/YandexRatingBadge';
import CatalogGrid, { Card as CatalogCard } from '@/components/CatalogGrid';
import { sortByPriority } from '@/lib/sort';
import {
  IconArrow,
  IconBolt,
  IconCheck,
  IconClock,
  IconCross,
  IconPulse,
  IconShield,
  IconSpark,
  IconStar,
  IconTarget,
  IconTruck,
} from '@/components/icons';

/**
 * Главная.
 *
 * Рендеринг: ISR — страница пересобирается раз в 60 секунд,
 * поэтому правка цены в CMS попадает на сайт без деплоя.
 *
 * Все тексты берутся из CMS (коллекция «Текстовый блок»): блоки
 * home.hero, home.catalog, home.process, home.advantages, home.tariffs,
 * home.cases, home.trust, home.faq, home.lead.
 */
export const revalidate = 60;

const ADV_ICON: Record<string, (p: { className?: string }) => React.ReactElement> = {
  bolt: IconBolt,
  truck: IconTruck,
  clock: IconClock,
  pulse: IconPulse,
  shield: IconShield,
  spark: IconSpark,
};

export default async function HomePage() {
  const cms = getCMS();
  const [settings, generators, cases, categories, reviews, allEquipment, content] =
    await Promise.all([
      cms.getSettings(),
      cms.getEquipmentByCategory('generator'),
      cms.getCases(),
      cms.getCategories(),
      cms.getReviews(),
      cms.getEquipment(),
      getContent(),
    ]);

  /* Подстановки: числа — из каталога, тексты — из CMS */
  const tokens = homeTokens(generators, settings);

  /**
   * Полоса брендов строится из данных CMS, а не из ручного списка.
   *
   * Раньше здесь был захардкожен список из восьми брендов, три из которых
   * (PALFINGER, UNIC, FASSI) в каталоге отсутствовали — переход по такой
   * ссылке давал пустую выдачу. Теперь показываем только те бренды,
   * которые реально есть, и ведём в ту категорию, где они есть.
   */
  const brandLinks = (() => {
    const byBrand = new Map<string, { count: number; slug: string }>();
    for (const e of allEquipment) {
      if (!e.brand || !e.categorySlug) continue;
      const cur = byBrand.get(e.brand);
      if (!cur) byBrand.set(e.brand, { count: 1, slug: e.categorySlug });
      else {
        cur.count++;
        /* Генераторы — самая большая категория, ссылаемся на неё */
        if (e.category === 'generator') cur.slug = e.categorySlug;
      }
    }
    return [...byBrand.entries()]
      .map(([brand, v]) => ({ brand, ...v }))
      .sort((a, b) => b.count - a.count);
  })();

  const cheapest = generators.reduce((a, b) => (b.price!.value < a.price!.value ? b : a));
  const calcModels = generators
    .filter((g) => g.price)
    .map((g) => ({ kW: g.power ?? 0, model: g.model, pricePerDay: g.price!.value }));

  /* Блоки страницы */
  const hero = content.o('home.hero', tokens);
  const brandsBlk = content.o('home.brands', tokens);
  const catalogBlk = content.o('home.catalog', tokens);
  const process = content.o('home.process', tokens);
  const advantages = content.o('home.advantages', tokens);
  const tariffsBlk = content.o('home.tariffs', tokens);
  const casesBlk = content.o('home.cases', tokens);
  const trust = content.o('home.trust', tokens);
  const faqBlk = content.o('home.faq', tokens);
  const leadBlk = content.o('home.lead', tokens);
  const calcLabels = content.o('calc.main', tokens);
  const cardLabels = content.o('catalog.card', tokens);

  const steps = (process.steps as { title: string; text: string; time: string }[]) ?? [];
  const advCards = (advantages.cards as { icon: string; title: string; text: string }[]) ?? [];
  const tariffs = (tariffsBlk.tariffs as {
    name: string;
    desc: string;
    featured: boolean;
    items: { label: string; on: boolean }[];
  }[]) ?? [];
  const faqs = (faqBlk.faq as { q: string; a: string }[]) ?? [];
  const leadPoints = (leadBlk.points as { title: string; text: string }[]) ?? [];

  return (
    <>
      <SiteHeader settings={settings} content={content} tokens={tokens} />

      <main id="main">
        {/* ─── HERO + калькулятор ─── */}
        <section className="hero">
          <div className="hero__bg" aria-hidden="true">
            {settings.heroImage && (
              <CmsImage image={settings.heroImage} alt="" priority />
            )}
          </div>

          <div className="container hero__inner">
            <div className="hero__content">
              <span className="hero__eyebrow">
                <IconShield />
                {hero.eyebrow as string}
              </span>

              <h1>
                {hero.h1Before as string}{' '}
                <em>{hero.h1Price as string}</em> {hero.h1After as string}
              </h1>

              <p className="hero__lead">{hero.lead as string}</p>

              <div className="hero__actions">
                <Link className="btn btn--lg" href="#calc">
                  {hero.btnPrimary as string}
                </Link>
                <Link className="btn btn--lg btn--ghost-light" href="/arendageneratorov">
                  {hero.btnSecondary as string}
                </Link>
              </div>

              <dl className="hero__facts">
                <div>
                  <dd className="hero__fact-value">{settings.fleetMW} МВт</dd>
                  <dt className="hero__fact-label">{(hero.factLabels as string[])?.[0]}</dt>
                </div>
                <div>
                  <dd className="hero__fact-value">от {settings.deliveryHours} ч</dd>
                  <dt className="hero__fact-label">{(hero.factLabels as string[])?.[1]}</dt>
                </div>
                <div>
                  <dd className="hero__fact-value">{tokens.years} лет</dd>
                  <dt className="hero__fact-label">{(hero.factLabels as string[])?.[2]}</dt>
                </div>
              </dl>
            </div>

            <CalcWidget
              models={calcModels}
              discountFromDays={settings.discountFromDays}
              discountPercent={settings.discountPercent}
              deliveryHours={settings.deliveryHours}
              phoneRaw={settings.phoneRaw}
              labels={calcLabels}
            />
          </div>
        </section>

        {/* ─── Бренды ─── */}
        <section className="brands" aria-label={brandsBlk.ariaLabel as string}>
          <div className="container brands__inner">
            <span className="brands__label">{brandsBlk.label as string}</span>
            <div className="brands__list">
              {brandLinks.map((b) => (
                <Link
                  className="brands__item"
                  key={b.brand}
                  href={`/${b.slug}?brand=${encodeURIComponent(b.brand)}`}
                  title={(brandsBlk.itemTitle as string)
                    .replace('{brand}', b.brand)
                    .replace('{brandCount}', String(b.count))
                    .replace('{itemWord}', pluralize(b.count, ['позиция', 'позиции', 'позиций']))}
                >
                  {b.brand}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Каталог ─── */}
        <section className="section" id="catalog">
          <div className="container">
            <div className="head">
              <span className="head__eyebrow">{catalogBlk.eyebrow as string}</span>
              <h2>{catalogBlk.title as string}</h2>
              <p>{catalogBlk.lead as string}</p>
            </div>

            <div className="cards cards--preview">
              {sortByPriority(generators).slice(0, 4).map((g) => (
                <CatalogCard item={g} key={g.slug} labels={cardLabels} />
              ))}
            </div>

            <div style={{ textAlign: 'center', marginTop: 28 }}>
              <Link className="btn btn--outline btn--lg" href="/arendageneratorov">
                {catalogBlk.btn as string}
                <IconArrow className="btn__icon" />
              </Link>
            </div>

            {/* Все категории техники — из CMS.
                Продажа б/у техники здесь не нужна: это не аренда,
                а отдельный раздел со своими условиями. Ссылка на него
                остаётся в подвале. */}
            <div className="cat-links">
              {categories
                .filter((c) => c.id !== 'used')
                .map((c) => (
                  <Link className="cat-links__item" href={`/${c.slug}`} key={c.id}>
                    <span>{c.label}</span>
                    <IconArrow />
                  </Link>
                ))}
            </div>
          </div>
        </section>

        {/* ─── Процесс ─── */}
        <section className="section section--card" id="how">
          <div className="container">
            <div className="head head--center">
              <span className="head__eyebrow">{process.eyebrow as string}</span>
              <h2>{process.title as string}</h2>
              <p>{process.lead as string}</p>
            </div>
            <div className="steps">
              {steps.map((s, i) => (
                <article className="step" key={s.title}>
                  <div className="step__num">{i + 1}</div>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                  <span className="step__time">
                    <IconClock />
                    {s.time}
                  </span>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Преимущества ─── */}
        <section className="section">
          <div className="container">
            <div className="head">
              <span className="head__eyebrow">{advantages.eyebrow as string}</span>
              <h2>{advantages.title as string}</h2>
              <p>{advantages.lead as string}</p>
            </div>
            <div className="advantages">
              {advCards.map((a) => {
                const Ico = ADV_ICON[a.icon] ?? IconSpark;
                return (
                  <article className="adv" key={a.title}>
                    <div className="adv__ico" aria-hidden="true"><Ico /></div>
                    <h3>{a.title}</h3>
                    <p>{a.text}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─── Тарифы ─── */}
        <section className="section section--card" id="tariffs">
          <div className="container">
            <div className="head head--center">
              <span className="head__eyebrow">{tariffsBlk.eyebrow as string}</span>
              <h2>{tariffsBlk.title as string}</h2>
              <p>{tariffsBlk.lead as string}</p>
            </div>
            <div className="tariffs">
              {tariffs.map((t) => (
                <article className={`tariff${t.featured ? ' tariff--featured' : ''}`} key={t.name}>
                  {t.featured && (
                    <span className="tariff__flag">{tariffsBlk.featuredFlag as string}</span>
                  )}
                  <div className="tariff__head">
                    <h3 className="tariff__name">{t.name}</h3>
                    <p className="tariff__desc">{t.desc}</p>
                  </div>
                  <ul className="tariff__list">
                    {t.items.map((it) => (
                      <li key={it.label}>
                        {it.on ? <IconCheck className="yes" /> : <IconCross className="no" />}
                        <span className={it.on ? undefined : 'is-off'}>{it.label}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="tariff__foot">
                    <Link className={`btn ${t.featured ? '' : 'btn--outline'} btn--block`} href="/#lead">
                      {tariffsBlk.btn as string}
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Объекты ─── */}
        <section className="section" id="cases">
          <div className="container">
            <div className="head">
              <span className="head__eyebrow">{casesBlk.eyebrow as string}</span>
              <h2>{casesBlk.title as string}</h2>
              <p>{casesBlk.lead as string}</p>
            </div>
            <div className="cases">
              {cases.slice(0, 6).map((c) => {
                return (
                  <Link className="case" href={`/${c.slug}`} key={c.slug}>
                    <div className="case__media">
                      {c.image ? (
                        <CmsImage image={c.image} alt={c.imageAlt || c.title} width={400} height={300} />
                      ) : (
                        <MediaPlaceholder
                          kind="case"
                          title={c.title}
                          subtitle={casesBlk.placeholder as string}
                        />
                      )}
                    </div>
                    <div className="case__overlay" />
                    <div className="case__body">
                      {c.kW && <span className="case__meta">{c.kW} кВт</span>}
                      <h3 className="case__title">{c.title}</h3>
                      <span className="case__link">
                        {casesBlk.cta as string}
                        <IconArrow />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─── Доверие ─── */}
        <section className="section section--card">
          <div className="container trust">
            <div>
              <div className="head">
                <span className="head__eyebrow">{trust.eyebrow as string}</span>
                <h2>{trust.title as string}</h2>
                <p>{trust.lead as string}</p>
              </div>
              {/* Оценка — живой бейдж Яндекс.Карт.
                  Свои цифры не выдумываем: виджет всегда показывает
                  актуальные данные карточек организации. */}
              <div className="rating">
                <span className="rating__icon" aria-hidden="true">
                  <IconStar />
                </span>
                <div className="rating__text">
                  <p className="rating__title">{trust.ratingTitle as string}</p>
                  <p className="rating__sub">{trust.ratingSub as string}</p>
                </div>
                <YandexRatingBadge orgId={settings.yandexOrgId ?? '1088163471'} />
                <a
                  className="rating__more"
                  href={settings.yandexReviewsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <b>{trust.reviewsLink as string}</b>
                  <span>{trust.reviewsLinkSub as string}</span>
                  <IconArrow className="rating__arrow" />
                </a>
              </div>
            </div>

            <div className="reviews">
              {reviews.slice(0, 2).map((r) => (
                <article className="review" key={r.author + r.date}>
                  <div className="review__head">
                    <span className="review__ava" aria-hidden="true">
                      {r.author.split(' ').map((w) => w[0]).join('').slice(0, 2)}
                    </span>
                    <div>
                      <p className="review__name">{r.author}</p>
                      <p className="review__role">{r.date}</p>
                    </div>
                    <div className="review__stars" aria-hidden="true">
                      {Array.from({ length: r.rating }).map((_, i) => (
                        <IconStar key={i} />
                      ))}
                    </div>
                  </div>
                  <p className="review__text">{r.text}</p>
                  {r.photos && r.photos.length > 0 && (
                    <div className="review__photos">
                      {r.photos.map((src) => (
                        <a
                          key={src}
                          href={src}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          aria-label={trust.photoAria as string}
                        >
                          <img
                            src={src}
                            alt=""
                            width={104}
                            height={78}
                            loading="lazy"
                            decoding="async"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                  <a
                    className="review__source"
                    href={r.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {trust.reviewCta as string}
                    <IconArrow />
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ─── FAQ ─── */}
        <section className="section" id="faq">
          <div className="container">
            <div className="head head--center">
              <span className="head__eyebrow">{faqBlk.eyebrow as string}</span>
              <h2>{faqBlk.title as string}</h2>
            </div>
            <Faq items={faqs} />
          </div>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: jsonLd(faqJsonLd(faqs)) }}
          />
        </section>

        {/* ─── Заявка ─── */}
        <section className="section section--dark" id="lead">
          <div className="container lead">
            <div>
              <span className="head__eyebrow">{leadBlk.eyebrow as string}</span>
              <h2>{leadBlk.title as string}</h2>
              <p style={{ color: '#94a3b8', fontSize: '1.0625rem', maxWidth: '52ch' }}>
                {leadBlk.lead as string}
              </p>
              <div className="lead__points">
                {leadPoints.map((p) => (
                  <div className="lead__point" key={p.title}>
                    <span className="lead__point-ico" aria-hidden="true"><IconClock /></span>
                    <div>
                      <b>{p.title}</b>
                      <span>{p.text}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <LeadForm
              labels={content.o('form.main', tokens)}
              phone={settings.phone}
              policyUrl={settings.legalPolicyUrl}
            />
          </div>
        </section>
      </main>

      <SiteFooter settings={settings} content={content} tokens={tokens} />
    </>
  );
}
