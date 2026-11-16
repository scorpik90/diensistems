/**
 * Bulk-импорт данных из content/seed.json в Strapi.
 *
 *   STRAPI_URL=http://localhost:1337
 *   STRAPI_TOKEN=<api-token>
 *   node scripts/import-to-strapi.mjs
 *
 * Идемпотентно: если запись с таким slug уже есть — обновляем,
 * иначе создаём. Повторный прогон безопасен.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const STRAPI_URL = (process.env.STRAPI_URL ?? 'http://localhost:1337').replace(/\/$/, '');
const TOKEN = process.env.STRAPI_TOKEN;

if (!TOKEN) {
  console.error('Нужен STRAPI_TOKEN. Выдайте его в Strapi: Settings → API Tokens → Full access.');
  process.exit(1);
}

/** Сопоставление полей seed → поля Strapi */
const COLLECTIONS = {
  equipment: (e) => ({
    slug: e.slug,
    category: e.category,
    isNew: e.isNew ?? false,
    /* Бренд нужен для фильтра в каталоге и для ссылок-логотипов */
    brand: e.brand ?? null,
    categoryLabel: e.categoryLabel,
    title: e.title,
    titleFull: e.titleFull,
    model: e.model,
    power: e.power,
    powerUnit: e.powerUnit,
    priceValue: e.price?.value ?? null,
    priceUnit: e.price?.unit ? e.price.unit : '/сутки',
    priceRaw: e.priceRaw,
    specGroups: e.specGroups,
    image: e.image,
    imageAlt: e.imageAlt,
    description: e.description,
    legacyUrls: e.legacyUrls,
  }),
  reviews: (r) => ({
    author: r.author,
    rating: r.rating,
    text: r.text,
    date: r.date,
    sourceUrl: r.sourceUrl,
    photos: r.photos ?? [],
    order: r.order ?? 0,
  }),
  articles: (a) => ({
    slug: a.slug,
    title: a.title,
    bodyHtml: a.bodyHtml,
    excerpt: a.excerpt,
    legacyUrls: a.legacyUrls,
  }),
  cases: (c) => ({
    slug: c.slug,
    title: c.title,
    kW: c.kW,
    bodyHtml: c.bodyHtml,
    image: c.image,
    legacyUrls: c.legacyUrls,
  }),
  pages: (p) => ({
    slug: p.slug,
    title: p.title,
    bodyHtml: p.bodyHtml,
    excerpt: p.excerpt,
    kind: p.kind,
    category: p.category ?? null,
    legacyUrls: p.legacyUrls,
  }),
  'price-tables': (t) => ({ index: t.index, rows: t.rows }),
  categories: (c) => ({ key: c.id, label: c.label, slug: c.slug, unit: c.unit }),
  'site-settings': (s) => s,
};

async function api(pathname, method = 'GET', body) {
  const res = await fetch(`${STRAPI_URL}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${pathname} → HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function upsert(collection, attrs, matchKey) {
  let existing = null;
  if (attrs[matchKey]) {
    const res = await api(
      `/api/${collection}?filters[${matchKey}][$eq]=${encodeURIComponent(attrs[matchKey])}&pagination[pageSize]=1`
    );
    existing = res?.data?.[0] ?? null;
  }

  if (existing) {
    /* Strapi 5: в маршрутах используется documentId, а не числовой id.
       PUT по числовому id отдаёт 404. */
    const docId = existing.documentId ?? existing.id;
    await api(`/api/${collection}/${docId}`, 'PUT', { data: attrs });
    return 'updated';
  }
  await api(`/api/${collection}`, 'POST', { data: attrs });
  return 'created';
}

/** Полная очистка коллекции — чтобы перезалив не оставлял дубликаты. */
async function reset(collection, matchKey) {
  const res = await api(`/api/${collection}?pagination[pageSize]=200`);
  const items = Array.isArray(res?.data) ? res.data : [];
  for (const item of items) {
    const docId = item.documentId ?? item.id;
    await api(`/api/${collection}/${docId}`, 'DELETE');
  }
  return items.length;
}

(async () => {
  const seed = JSON.parse(
    await fs.readFile(path.join(ROOT, 'content', 'seed.json'), 'utf8')
  );

  /* Юридические документы наполняются вручную (content/legal-pages.json),
     в отличие от seed.json, который генерируется миграцией с боевого сайта. */
  let legalPages = [];
  try {
    const legal = JSON.parse(await fs.readFile(path.join(ROOT, 'content', 'legal-pages.json'), 'utf8'));
    legalPages = legal.pages ?? [];
    console.log(`Юридические документы: ${legalPages.length}\n`);
  } catch {
    console.log('Юридические документы: файл не найден, пропускаю\n');
  }

  /* Отзывы с Яндекс.Карт — отдельный файл, обновляется скриптом
     fetch-yandex-reviews.mjs */
  let reviews = [];
  try {
    const rev = JSON.parse(await fs.readFile(path.join(ROOT, 'content', 'reviews.json'), 'utf8'));
    reviews = rev.reviews ?? [];
    console.log(`Отзывы с Яндекс.Карт: ${reviews.length}\n`);
  } catch {
    console.log('Отзывы с Яндекс.Карт: файл не найден, пропускаю\n');
  }

  console.log(`Импорт в ${STRAPI_URL}\n`);

  const plan = [
    ['site-settings', [seed.settings], 'phone'],
    ['categories', seed.categories, 'key'],
    ['equipment', seed.equipment, 'slug'],
    ['price-tables', seed.priceTables, 'index'],
    ['cases', seed.cases, 'slug'],
    ['articles', seed.articles, 'slug'],
    ['reviews', reviews, 'author'],
    ['pages', [...seed.pages, ...legalPages], 'slug'],
  ];

  /* --reset: сначала чистим коллекции, чтобы не накапливать дубли */
  if (process.argv.includes('--reset')) {
    console.log('Очистка коллекций (--reset):');
    for (const [collection] of plan) {
      const n = await reset(collection);
      console.log(`  ${collection}: удалено ${n}`);
    }
    const redirects = Object.entries(seed.redirects ?? {}).map(([from, to]) => ({
      from,
      to,
      reason: 'migration',
    }));
    if (redirects.length) {
      const n = await reset('redirects');
      console.log(`  redirects: удалено ${n}`);
    }
    console.log('');
  }

  for (const [collection, items, matchKey] of plan) {
    const map = COLLECTIONS[collection];
    if (!map) {
      console.log(`[${collection}] нет маппинга — пропускаем`);
      continue;
    }

    console.log(`[${collection}] ${items.length} записей`);
    let created = 0;
    let updated = 0;

    for (const item of items) {
      try {
        const r = await upsert(collection, map(item), matchKey);
        if (r === 'created') created++;
        else updated++;
      } catch (e) {
        console.error(`  ! ${item.slug ?? item.index ?? item.id}: ${e.message}`);
      }
    }

    console.log(`  создано: ${created}, обновлено: ${updated}\n`);
  }

  /* Редиректы */
  const redirectItems = Object.entries(seed.redirects ?? {}).map(([from, to]) => ({
    from,
    to,
    reason: 'migration',
  }));
  if (redirectItems.length) {
    console.log(`[redirects] ${redirectItems.length} записей`);
    let created = 0;
    let updated = 0;
    for (const r of redirectItems) {
      try {
        const res = await upsert('redirects', r, 'from');
        if (res === 'created') created++;
        else updated++;
      } catch (e) {
        console.error(`  ! ${r.from}: ${e.message}`);
      }
    }
    console.log(`  создано: ${created}, обновлено: ${updated}\n`);
  }

  console.log('Готово. Переключите фронт: CMS_PROVIDER=strapi');
})();
