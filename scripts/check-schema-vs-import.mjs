/**
 * Сверка схем Strapi с тем, что реально шлёт скрипт импорта.
 *
 *   node scripts/check-schema-vs-import.mjs
 *
 * Ловит расхождения типа «в схеме legacyUrl, а импорт шлёт legacyUrls» —
 * именно они дают «Invalid key …» на этапе загрузки данных.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/* Ключи, которые шлёт import-to-strapi.mjs для каждой коллекции */
const PAYLOAD = {
  'site-settings': ['company', 'legalName', 'phone', 'phoneRaw', 'email', 'address', 'city',
    'foundedYear', 'fleetMW', 'deliveryHours', 'rating', 'ratingCount', 'workingHours',
    'discountFromDays', 'discountPercent'],
  categories: ['key', 'label', 'slug', 'unit'],
  equipment: ['slug', 'category', 'categoryLabel', 'title', 'titleFull', 'model', 'power',
    'powerUnit', 'priceValue', 'priceUnit', 'priceRaw', 'specGroups', 'image', 'imageAlt',
    'description', 'legacyUrls'],
  'price-tables': ['index', 'rows'],
  cases: ['slug', 'title', 'kW', 'bodyHtml', 'image', 'legacyUrls'],
  articles: ['slug', 'title', 'bodyHtml', 'excerpt', 'legacyUrls'],
  pages: ['slug', 'title', 'bodyHtml', 'excerpt', 'kind', 'category', 'legacyUrls'],
  redirects: ['from', 'to', 'reason'],
};

/* schema.json → коллекция */
const COLLECTION = {
  'site-settings': 'site-setting',
  categories: 'category',
  equipment: 'equipment-item',
  'price-tables': 'price-table',
  cases: 'case',
  articles: 'article',
  pages: 'page',
  redirects: 'redirect',
};

let problems = 0;

for (const [collection, uid] of Object.entries(COLLECTION)) {
  const file = path.join(ROOT, 'cms-admin', 'src', 'api', uid, 'content-types', uid, 'schema.json');
  if (!fs.existsSync(file)) {
    console.log(`  ! ${collection}: нет схемы (${uid})`);
    problems++;
    continue;
  }

  const schema = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  const attrs = new Set(Object.keys(schema.attributes ?? {}));
  const sent = PAYLOAD[collection] ?? [];

  const unknown = sent.filter((k) => !attrs.has(k));
  const missing = [...attrs].filter(
    (k) => !sent.includes(k) && !['createdAt', 'updatedAt', 'publishedAt', 'createdBy', 'updatedBy', 'locale', 'id', 'documentId'].includes(k)
  );

  /* Незаполненные поля — предупреждение; критично только то,
     чего в схеме нет, но что шлёт импорт. */
  const ok = unknown.length === 0;
  if (!ok) problems++;

  console.log(`  ${ok ? '✓' : '✗'} ${collection.padEnd(14)} атрибутов: ${[...attrs].join(', ')}`);
  if (unknown.length) console.log(`      импорт шлёт несуществующие поля: ${unknown.join(', ')}`);
  if (missing.length) console.log(`      (необязательные, не заполняются импортом: ${missing.join(', ')})`);
}

console.log(
  problems === 0
    ? '\n✓ Схемы и импорт согласованы.'
    : `\n✗ Расхождений: ${problems}. Импорт упадёт с «Invalid key …».`
);
process.exit(problems === 0 ? 0 : 1);
