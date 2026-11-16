import Link from 'next/link';
import { Fragment } from 'react';
import type { Equipment, SiteSettings } from '@/lib/types';
import { breadcrumbJsonLd, jsonLd, productJsonLd } from '@/lib/seo';
import { sanitizeHtml } from '@/lib/sanitize';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import LeadForm from '@/components/LeadForm';
import { IconCheck, IconPhone } from '@/components/icons';
import MediaPlaceholder from '@/components/MediaPlaceholder';
import { equipmentImageDir } from '@/lib/media';

/**
 * Универсальная карточка позиции.
 *
 * Один шаблон обслуживает все 6 категорий: ДГУ, ПЭС, компрессоры,
 * компрессоры на смену, манипуляторы и продажу б/у.
 * На боевом сайте для каждой был свой PHP-шаблон — здесь разница
 * только в данных из CMS.
 */
export default function EquipmentView({
  item,
  settings,
}: {
  item: Equipment;
  settings: SiteSettings;
}) {
  const fmt = new Intl.NumberFormat('ru-RU');
  const priceLabel = item.price ? `${fmt.format(item.price.value)} ₽` : null;
  const imgDir = equipmentImageDir(item);
  /* Продажа б/у — это не аренда: теги и кнопка заказа тут лишние */
  const isUsed = item.category === 'used';
  /* Категория позиции — из неё и крошки, и раздел каталога */
  const catSlug = item.categorySlug ?? 'arendageneratorov';

  return (
    <>
      <SiteHeader settings={settings} />

      <main id="main">
        <div className="container">
          <nav aria-label="Хлебные крошки">
            <ul className="crumbs">
              <li><Link href="/">Главная</Link></li>
              <li aria-hidden="true">/</li>
              <li><Link href={`/${catSlug}`}>{item.categoryLabel}</Link></li>
              <li aria-hidden="true">/</li>
              <li aria-current="page">{item.title}</li>
            </ul>
          </nav>
        </div>

        <section className="section section--tight">
          <div className="container product">
            <div className="product__media">
              {imgDir ? (
                <picture>
                  <source type="image/avif" srcSet={`/images/${imgDir}/400.avif`} />
                  <source type="image/webp" srcSet={`/images/${imgDir}/400.webp`} />
                  <img
                    src={`/images/${imgDir}/400.jpg`}
                    alt={item.imageAlt || `${item.title} — аренда`}
                    width={400}
                    height={300}
                    fetchPriority="high"
                    decoding="async"
                  />
                </picture>
              ) : (
                <MediaPlaceholder kind="product" title={item.model} subtitle={item.categoryLabel} />
              )}
            </div>

            <div className="product__info">
              <p className="product__cat">{item.categoryLabel}</p>
              <h1>{item.title}</h1>
              <p className="product__model">{item.model}</p>

              {priceLabel && (
                <div className="product__price">
                  <span className="product__price-val">
                    {priceLabel}
                    {/* Единица в CMS уже начинается со слэша («/сутки»),
                        поэтому добавляем его только если его нет —
                        иначе получается «//сутки». */}
                    <small>
                      {isUsed
                        ? '/шт.'
                        : item.price?.unit
                          ? `/${item.price.unit.replace(/^\/+/, '')}`
                          : '/сутки'}
                    </small>
                  </span>
                </div>
              )}

              {item.power != null && !isUsed && (
                <div className="product__chips">
                  <span className="badge badge--info">
                    {item.power} {item.powerUnit}
                  </span>
                  <span className="badge badge--ok">ТО и подмена включены</span>
                  <span className="badge badge--ok">Доставка от {settings.deliveryHours} ч</span>
                </div>
              )}

              <div className="product__actions">
                {!isUsed && (
                  <Link
                    className="btn btn--lg"
                    href={`/#lead?model=${encodeURIComponent(item.model)}&kw=${item.power ?? ''}`}
                  >
                    Заказать
                  </Link>
                )}
                <a className="btn btn--outline btn--lg" href={`tel:${settings.phoneRaw}`}>
                  <IconPhone className="btn__icon" />
                  {settings.phone}
                </a>
              </div>

              {/* Блок «Возможно вам понадобятся» — про аренду.
                  В разделе продажи б/у он неуместен. */}
              {!isUsed && (
                <>
                  <h2 className="product__sub">Возможно вам понадобятся</h2>
                  <ul className="product__includes">
                    {[
                      'Внешняя топливная ёмкость 2000 л',
                      'Кабель для подключения',
                      'Оператор для оборудования',
                      'Силовой распределительный щит',
                      'Доставка, монтаж и подключение',
                      'Поставка дизельного топлива',
                    ].map((t) => (
                      <li key={t}>
                        <IconCheck />
                        {t}
                      </li>
                    ))}
                    {/* Шумозащитное ограждение — арендуется отдельно,
                        на стройплощадках рядом с жильём оно обязательно */}
                    <li>
                      <IconCheck />
                      <Link href="/dopoborudovanie">
                        Шумозащитное ограждение генератора
                      </Link>
                    </li>
                  </ul>
                </>
              )}
            </div>
          </div>
        </section>

        <section className="section section--card">
          <div className="container">
            <h2 className="gen-tech">Технические характеристики</h2>
            {item.specGroups.length > 0 ? (
              /* Таблица: колонки «Параметр / Значение», группы —
                 строки-разделители. Так ТТХ читаются как спецификация,
                 а не как набор карточек. */
              <div className="spec-table-wrap">
                <table className="spec-table">
                  <thead>
                    <tr>
                      <th scope="col">Параметр</th>
                      <th scope="col" className="is-value">Значение</th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.specGroups.map((g) => (
                      <Fragment key={g.group}>
                        <tr className="spec-table__group">
                          <th colSpan={2} scope="colgroup">
                            {g.group}
                          </th>
                        </tr>
                        {g.rows.map((r) => (
                          <tr key={r.label}>
                            <td>{r.label}</td>
                            <td className="is-value">{r.value}</td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: 'var(--slate-600)' }}>
                Полные характеристики этой позиции уточните у инженера: {settings.phone}.
              </p>
            )}

            {item.description && (
              <div className="gen-body">
                <p>{item.description.slice(0, 1200)}</p>
              </div>
            )}
          </div>
        </section>

        <section className="section section--dark" id="lead">
          <div className="container lead">
            <div>
              <span className="head__eyebrow">{isUsed ? 'Продажа' : 'Заявка'}</span>
              <h2>
                {isUsed
                  ? 'Уточним условия по этой позиции'
                  : 'Рассчитаем стоимость за 10 минут'}
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '1.0625rem', maxWidth: '52ch' }}>
                {isUsed
                  ? 'Отправим условия продажи, состояние техники и документы. ' +
                    'Покажем технику в работе — на базе в Химках.'
                  : 'Инженер уточнит нагрузку и режим работы и пришлёт коммерческое предложение ' +
                    'с фиксированной ценой.'}
              </p>
            </div>
            <LeadForm defaultTopic={item.categoryLabel} />
          </div>
        </section>
      </main>

      <SiteFooter settings={settings} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(productJsonLd(item, settings)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            breadcrumbJsonLd([
              { name: 'Главная', url: '/' },
              { name: item.categoryLabel, url: `/${catSlug}` },
              { name: item.title, url: `/${item.slug}` },
            ])
          ),
        }}
      />
    </>
  );
}
