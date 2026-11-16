import Link from 'next/link';
import { getCMS } from '@/lib/cms';
import { money } from '@/lib/format';
import { CASE_IMAGE_WIDTH, caseImageDir, equipmentImageDir } from '@/lib/media';
import { faqJsonLd } from '@/lib/seo';
import { ADVANTAGES, FAQS, STEPS, TARIFFS } from '@/lib/content-blocks';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import CalcWidget from '@/components/CalcWidget';
import LeadForm from '@/components/LeadForm';
import Faq from '@/components/Faq';
import MediaPlaceholder from '@/components/MediaPlaceholder';
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

/** Бренды в парке — клик открывает каталог с фильтром по бренду.
    Список собирается из данных CMS (см. brandLinks ниже), поэтому
    каждая ссылка ведёт в каталог, где такой бренд точно есть. */

export default async function HomePage() {
  const cms = getCMS();
  const [settings, generators, cases, categories, reviews, allEquipment] = await Promise.all([
    cms.getSettings(),
    cms.getEquipmentByCategory('generator'),
    cms.getCases(),
    cms.getCategories(),
    cms.getReviews(),
    cms.getEquipment(),
  ]);

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

  return (
    <>
      <SiteHeader settings={settings} />

      <main id="main">
        {/* ─── HERO + калькулятор ─── */}
        <section className="hero">
          <div className="hero__bg" aria-hidden="true">
            <picture>
              <source type="image/avif" srcSet="/images/hero-2/1280.avif" />
              <source type="image/webp" srcSet="/images/hero-2/1280.webp" />
              <img
                src="/images/hero-2/1280.jpg"
                alt=""
                width={1280}
                height={337}
                fetchPriority="high"
                decoding="async"
              />
            </picture>
          </div>

          <div className="container hero__inner">
            <div className="hero__content">
              <span className="hero__eyebrow">
                <IconShield />
                Японское оборудование AIRMAN и DENYO
              </span>

              <h1>
                Аренда генераторов{' '}
                <em>от {money(cheapest.price!.value)} ₽/сутки</em> с доставкой за 2 часа
              </h1>

              <p className="hero__lead">
                Собственный парк дизельных электростанций на {settings.fleetMW} МВт — от 8 до 800 кВт.
                Техобслуживание, ГРЩ и силовой кабель включены в тариф.
                Круглосуточная выездная поддержка по Москве и области.
              </p>

              <div className="hero__actions">
                <Link className="btn btn--lg" href="#calc">
                  Подобрать мощность за 30 секунд
                </Link>
                <Link className="btn btn--lg btn--ghost-light" href="/arendageneratorov">
                  Смотреть каталог из {generators.length} моделей
                </Link>
              </div>

              <dl className="hero__facts">
                <div>
                  <dd className="hero__fact-value">{settings.fleetMW} МВт</dd>
                  <dt className="hero__fact-label">собственный парк</dt>
                </div>
                <div>
                  <dd className="hero__fact-value">от {settings.deliveryHours} ч</dd>
                  <dt className="hero__fact-label">доставка по Москве</dt>
                </div>
                <div>
                  <dd className="hero__fact-value">{2026 - settings.foundedYear} лет</dd>
                  <dt className="hero__fact-label">на рынке с {settings.foundedYear}</dt>
                </div>
              </dl>
            </div>

            <CalcWidget
              models={calcModels}
              discountFromDays={settings.discountFromDays}
              discountPercent={settings.discountPercent}
              deliveryHours={settings.deliveryHours}
            />
          </div>
        </section>

        {/* ─── Бренды ─── */}
        <section className="brands" aria-label="Оборудование в парке">
          <div className="container brands__inner">
            <span className="brands__label">В парке</span>
            <div className="brands__list">
              {brandLinks.map((b) => (
                <Link
                  className="brands__item"
                  key={b.brand}
                  href={`/${b.slug}?brand=${encodeURIComponent(b.brand)}`}
                  title={`Каталог техники ${b.brand} — ${b.count} позиций`}
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
              <span className="head__eyebrow">Каталог</span>
              <h2>Дизельные генераторы в аренду</h2>
              <p>
                Каждая модель в наличии на базе в Химках. Сдаём «сухую аренду» — без топлива и
                оператора, либо по тарифу «под ключ» с топливом, ТО и дежурным механиком.
              </p>
            </div>

            <div className="cards cards--preview">
              {sortByPriority(generators).slice(0, 4).map((g) => (
                <CatalogCard item={g} key={g.slug} />
              ))}
            </div>

            <div style={{ textAlign: 'center', marginTop: 28 }}>
              <Link className="btn btn--outline btn--lg" href="/arendageneratorov">
                Весь каталог — {generators.length} моделей
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
              <span className="head__eyebrow">Процесс</span>
              <h2>Как арендовать генератор</h2>
              <p>От заявки до запуска — в среднем 2–4 часа в пределах МКАД</p>
            </div>
            <div className="steps">
              {STEPS.map((s) => (
                <article className="step" key={s.num}>
                  <div className="step__num">{s.num}</div>
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
              <span className="head__eyebrow">Почему мы</span>
              <h2>Собственный парк — а не субаренда</h2>
              <p>
                Мы владеем техникой и сдаём её в субаренду, а не перепродаём. Это значит цена без наценки,
                подменная машина в наличии и ответственность за результат — наша.
              </p>
            </div>
            <div className="advantages">
              {ADVANTAGES.map((a) => {
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
              <span className="head__eyebrow">Тарифы</span>
              <h2>Выбор пакета услуг</h2>
              <p>
                Скидка {settings.discountPercent}% при аренде от {settings.discountFromDays} дней.
                Доставка и вывоз по Москве в пределах МКАД — бесплатно.
              </p>
            </div>
            <div className="tariffs">
              {TARIFFS.map((t) => (
                <article className={`tariff${t.featured ? ' tariff--featured' : ''}`} key={t.name}>
                  {t.featured && <span className="tariff__flag">Выбирают чаще</span>}
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
                      Заказать
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
              <span className="head__eyebrow">Объекты</span>
              <h2>Где мы работаем</h2>
              <p>
                Строительные площадки, торговые центры, рестораны, мероприятия и режимные объекты
                по Москве и Московской области.
              </p>
            </div>
            <div className="cases">
              {cases.slice(0, 6).map((c) => {
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

        {/* ─── Доверие ─── */}
        <section className="section section--card">
          <div className="container trust">
            <div>
              <div className="head">
                <span className="head__eyebrow">Доверие</span>
                <h2>{2026 - settings.foundedYear} лет без простоев</h2>
                <p>
                  Средняя оценка на картах и в отзывах клиентов. Ниже — реальные ситуации
                  из практики отдела аренды.
                </p>
              </div>
              {/* Оценка — живой бейдж Яндекс.Карт.
                  Свои цифры не выдумываем: виджет всегда показывает
                  актуальные данные карточек организации. */}
              <div className="rating">
                <span className="rating__icon" aria-hidden="true">
                  <IconStar />
                </span>
                <div className="rating__text">
                  <p className="rating__title">Рейтинг на Яндекс.Картах</p>
                  <p className="rating__sub">
                    Оценка и число отзывов — живые, из карточек организации
                  </p>
                </div>
                <YandexRatingBadge orgId="1088163471" />
                <a
                  className="rating__more"
                  href={settings.yandexReviewsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <b>Все отзывы</b>
                  <span>на Яндекс.Картах</span>
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
                          aria-label="Фото из отзыва на Яндекс.Картах"
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
                    Читать на Яндекс.Картах
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
              <span className="head__eyebrow">FAQ</span>
              <h2>Частые вопросы</h2>
            </div>
            <Faq items={FAQS} />
          </div>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQS)) }}
          />
        </section>

        {/* ─── Заявка ─── */}
        <section className="section section--dark" id="lead">
          <div className="container lead">
            <div>
              <span className="head__eyebrow">Заявка</span>
              <h2>Рассчитаем стоимость за 10 минут</h2>
              <p style={{ color: '#94a3b8', fontSize: '1.0625rem', maxWidth: '52ch' }}>
                Оставьте контакты — инженер перезвонит, уточнит нагрузку и режим работы
                и пришлёт коммерческое предложение с фиксированной ценой.
              </p>
              <div className="lead__points">
                {[
                  ['Ответ за 10 минут', 'в рабочее время — с 8:00 до 20:00, без выходных'],
                  ['Расчёт без обязательств', 'подбор модели и схемы подключения бесплатно'],
                  ['КП и договор за час', 'пришлём смету с ценами, сроками и условиями'],
                ].map(([t, d]) => (
                  <div className="lead__point" key={t}>
                    <span className="lead__point-ico" aria-hidden="true"><IconClock /></span>
                    <div>
                      <b>{t}</b>
                      <span>{d}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <LeadForm />
          </div>
        </section>
      </main>

      <SiteFooter settings={settings} />
    </>
  );
}
