import Link from 'next/link';
import { Fragment } from 'react';
import type { Equipment, SiteSettings } from '@/lib/types';
import type { Content } from '@/lib/content';
import { breadcrumbJsonLd, jsonLd, productJsonLd } from '@/lib/seo';
import { baseTokens } from '@/lib/tokens';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import LeadForm from '@/components/LeadForm';
import { IconCheck, IconPhone } from '@/components/icons';
import MediaPlaceholder from '@/components/MediaPlaceholder';
import CmsImage from '@/components/CmsImage';

/**
 * Универсальная карточка позиции.
 *
 * Один шаблон обслуживает все 6 категорий: ДГУ, ПЭС, компрессоры,
 * компрессоры на смену, манипуляторы и продажу б/у.
 * На боевом сайте для каждого был свой PHP-шаблон — здесь разница
 * только в данных из CMS.
 */
export default function EquipmentView({
  item,
  settings,
  content,
}: {
  item: Equipment;
  settings: SiteSettings;
  content: Content;
}) {
  const fmt = new Intl.NumberFormat('ru-RU');
  const priceLabel = item.price ? `${fmt.format(item.price.value)} ₽` : null;
  /* Продажа б/у — это не аренда: теги и кнопка заказа тут лишние */
  const isUsed = item.category === 'used';
  /* Категория позиции — из неё и крошки, и раздел каталога */
  const catSlug = item.categorySlug ?? 'arendageneratorov';

  const tokens = baseTokens(settings);
  const p = content.o('product.main', tokens);
  const card = content.o('catalog.card', tokens);
  const crumbHome = content.s('global.breadcrumbHome', 'text', tokens) || 'Главная';
  const also = p.also as { label: string; href: string }[] | undefined;
  const alsoItems = Array.isArray(also) ? also : [];

  return (
    <>
      <SiteHeader settings={settings} content={content} tokens={tokens} />

      <main id="main">
        <div className="container">
          <nav aria-label="Хлебные крошки">
            <ul className="crumbs">
              <li><Link href="/">{crumbHome}</Link></li>
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
              {item.image ? (
                <CmsImage
                  image={item.image}
                  alt={
                    item.imageAlt ||
                    (card.altText as string || '{title} — аренда').replace('{title}', item.title)
                  }
                  width={400}
                  height={300}
                  priority
                />
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
                        ? (p.unitSale as string)
                        : item.price?.unit
                          ? `/${item.price.unit.replace(/^\/+/, '')}`
                          : (p.unitRent as string)}
                    </small>
                  </span>
                </div>
              )}

              {item.power != null && !isUsed && (
                <div className="product__chips">
                  <span className="badge badge--info">
                    {item.power} {item.powerUnit}
                  </span>
                  <span className="badge badge--ok">{p.badgeService as string}</span>
                  <span className="badge badge--ok">{p.badgeDelivery as string}</span>
                </div>
              )}

              <div className="product__actions">
                {!isUsed && (
                  <Link
                    className="btn btn--lg"
                    href={`/?model=${encodeURIComponent(item.model)}&kw=${item.power ?? ''}&cat=${item.category}#lead`}
                  >
                    {card.btnOrder as string}
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
                  <h2 className="product__sub">{p.h2Also as string}</h2>
                  <ul className="product__includes">
                    {alsoItems.map((t) => (
                      <li key={t.label}>
                        <IconCheck />
                        {t.href ? <Link href={t.href}>{t.label}</Link> : t.label}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        </section>

        <section className="section section--card">
          <div className="container">
            <h2 className="gen-tech">{p.h2Specs as string}</h2>
            {item.specGroups.length > 0 ? (
              /* Таблица: колонки «Параметр / Значение», группы —
                 строки-разделители. Так ТТХ читаются как спецификация,
                 а не как набор карточек. */
              <div className="spec-table-wrap">
                <table className="spec-table">
                  <thead>
                    <tr>
                      <th scope="col">{p.thParam as string}</th>
                      <th scope="col" className="is-value">{p.thValue as string}</th>
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
              <p style={{ color: 'var(--slate-600)' }}>{p.noSpecs as string}</p>
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
              <span className="head__eyebrow">
                {isUsed ? (p.eyebrowUsed as string) : (p.eyebrowRent as string)}
              </span>
              <h2>{isUsed ? (p.h2Used as string) : (p.h2Rent as string)}</h2>
              <p style={{ color: '#94a3b8', fontSize: '1.0625rem', maxWidth: '52ch' }}>
                {isUsed ? (p.leadUsed as string) : (p.leadRent as string)}
              </p>
            </div>
            <LeadForm
              defaultTopic={item.categoryLabel}
              labels={content.o('form.main', tokens)}
              phone={settings.phone}
              policyUrl={settings.legalPolicyUrl}
            />
          </div>
        </section>
      </main>

      <SiteFooter settings={settings} content={content} tokens={tokens} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(productJsonLd(item, settings)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            breadcrumbJsonLd([
              { name: crumbHome, url: '/' },
              { name: item.categoryLabel, url: `/${catSlug}` },
              { name: item.title, url: `/${item.slug}` },
            ])
          ),
        }}
      />
    </>
  );
}
