/**
 * Снимок состояния CMS — страховка на случай недоступности CMS.
 *
 *   node scripts/export-snapshot.mjs
 *
 * Забирает сырые записи из Strapi (те же запросы, что делает сайт)
 * и складывает их в content/snapshot.json. Если CMS временно лежит,
 * сайт продолжит работать на этом снимке вместо 500.
 *
 * Снимок генерируется из CMS — руками он не ведётся. Обновлять стоит
 * после крупных правок контента и обязательно перед деплоем.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const STRAPI_URL = (process.env.STRAPI_URL ?? 'http://127.0.0.1:1337').replace(/\/$/, '');
const TOKEN = process.env.STRAPI_TOKEN;

if (!TOKEN) {
  console.error('Нужен STRAPI_TOKEN (в .env проекта).');
  process.exit(1);
}

const H = { Authorization: `Bearer ${TOKEN}` };

async function list(pathname) {
  const res = await fetch(`${STRAPI_URL}/api${pathname}`, { headers: H });
  if (!res.ok) throw new Error(`${pathname} → HTTP ${res.status}`);
  const json = await res.json();
  return json?.data ?? [];
}

const COLLECTIONS = {
  categories: '/categories?sort=key:asc&populate=*&pagination[pageSize]=500',
  equipment: '/equipment?pagination[pageSize]=500&populate=*',
  articles: '/articles?sort=title:asc&pagination[pageSize]=500',
  reviews: '/reviews?sort=order:asc&pagination[pageSize]=500',
  cases: '/cases?sort=title:asc&populate=*&pagination[pageSize]=500',
  pages: '/pages?sort=slug:asc&pagination[pageSize]=500',
  priceTables: '/price-tables?sort=index:asc&pagination[pageSize]=500',
  redirects: '/redirects?pagination[pageSize]=500',
  contentBlocks: '/content-blocks?sort=order:asc&pagination[pageSize]=500',
  menuItems: '/menu-items?sort=order:asc&pagination[pageSize]=500',
};

console.log(`CMS: ${STRAPI_URL}\n`);

const records = {};
for (const [key, pathname] of Object.entries(COLLECTIONS)) {
  const items = await list(pathname);
  records[key] = items;
  console.log(`  ${key.padEnd(15)} ${items.length}`);
}

const settings = (await list('/site-settings?pagination[pageSize]=1&populate=*'))[0] ?? null;
console.log(`  ${'settings'.padEnd(15)} ${settings ? 1 : 0}`);

const snapshot = {
  generatedAt: new Date().toISOString(),
  records: { settings, ...records },
};

const file = path.join(ROOT, 'content', 'snapshot.json');
fs.writeFileSync(file, JSON.stringify(snapshot, null, 2), 'utf8');

const size = Math.round(fs.statSync(file).size / 1024);
console.log(`\n✓ записан ${path.relative(ROOT, file)} (${size} КБ)`);
console.log('  Обновить перед деплоем: node scripts/export-snapshot.mjs');
