import type { Equipment, SiteSettings } from './types';

/* ─── SEO ────────────────────────────────────────────────────────────── */

export const SITE_URL = process.env.SITE_URL ?? 'https://genorg.ru';

export function abs(path: string) {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Сериализация JSON-LD для <script type="application/ld+json">.
 *
 * JSON.stringify сам по себе безопасен, но строка «</script>», попавшая
 * из поля CMS (например, в title), разорвала бы тег и открыла XSS.
 * Поэтому все «<» эскейпятся в \u003c — для поисковиков это тот же символ,
 * а преждевременное закрытие тега становится невозможным.
 */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function organizationJsonLd(settings: SiteSettings) {
  return {
    '@context': 'https://schema.org',
    '@type': ['Organization', 'LocalBusiness'],
    '@id': `${SITE_URL}/#organization`,
    name: settings.company,
    legalName: settings.legalName,
    url: SITE_URL,
    /* Логотип лежит в /public — ссылка на легаси-путь /site/images/logo/… давала 404 */
    logo: abs('/logo.png'),
    foundingDate: String(settings.foundedYear),
    telephone: settings.phoneRaw,
    email: settings.email,
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Химки',
      addressRegion: 'Московская область',
      streetAddress: 'Ленинградское шоссе, 360Б',
      addressCountry: 'RU',
    },
    areaServed: ['Москва', 'Московская область'],
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: [
        'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
      ],
      opens: '00:00',
      closes: '23:59',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: String(settings.rating),
      reviewCount: String(settings.ratingCount),
      bestRating: '5',
    },
  };
}

/** Product + Offer для позиции каталога. Цена берётся из CMS — одна истина. */
export function productJsonLd(item: Equipment, settings: SiteSettings) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: item.title,
    description: item.description.slice(0, 300) || item.title,
    sku: item.slug,
    category: item.categoryLabel,
    brand: { '@type': 'Brand', name: item.model.split(' ')[0] },
    image: item.imageDir ? abs(`/images/${item.imageDir}/800.jpg`) : undefined,
    offers: item.price
      ? {
          '@type': 'Offer',
          price: item.price.value,
          priceCurrency: 'RUB',
          availability: 'https://schema.org/InStock',
          url: abs(`/${item.slug}`),
          seller: { '@id': `${SITE_URL}/#organization` },
          /* Аренда — за сутки, продажа — за единицу техники */
          ...(item.category === 'used'
            ? { unitCode: 'C62' }
            : { priceSpecification: { '@type': 'UnitPriceSpecification', priceCurrency: 'RUB' } }),
        }
      : undefined,
  };
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: abs(it.url),
    })),
  };
}

export function faqJsonLd(faqs: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}
