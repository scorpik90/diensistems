/**
 * Сводка по содержимому CMS.
 *
 *   node scripts/check-cms.mjs
 *
 * Показывает объёмы данных в Strapi и одну карточку целиком —
 * удобно убедиться, что импорт прошёл корректно.
 */
import fs from 'node:fs';

const BASE = process.env.STRAPI_URL ?? 'http://127.0.0.1:1337';
const tokens = JSON.parse(fs.readFileSync('.strapi-tokens.json', 'utf8'));
const token = tokens['genorg-read'];

/* В Strapi 5 REST-ответы плоские: data[i].{атрибуты} */
const attrs = (item) => item?.attributes ?? item ?? {};

const cols = [
  'site-settings',
  'categories',
  'equipment',
  'price-tables',
  'cases',
  'articles',
  'pages',
  'redirects',
];

console.log('данные в Strapi:');
for (const c of cols) {
  const res = await fetch(`${BASE}/api/${c}?pagination[pageSize]=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  const total = body?.meta?.pagination?.total ?? '?';
  console.log(`  ${c.padEnd(16)} HTTP ${res.status}  записей: ${total}`);
}

const eq = await (
  await fetch(`${BASE}/api/equipment?filters[slug][$eq]=arendadizelnogogeneratora100kvt`, {
    headers: { Authorization: `Bearer ${token}` },
  })
).json();
const item = attrs(eq?.data?.[0]);
console.log('\nкарточка 100 кВт:');
console.log('  title       :', item.title);
console.log('  model       :', item.model);
console.log('  power       :', item.power, item.powerUnit);
console.log('  price       :', item.priceValue, item.priceUnit);
console.log('  категория   :', item.category);
console.log('  спек-групп  :', (item.specGroups ?? []).length);
console.log('  legacyUrls  :', JSON.stringify(item.legacyUrls));

const st = await (
  await fetch(`${BASE}/api/site-settings?pagination[pageSize]=1`, {
    headers: { Authorization: `Bearer ${token}` },
  })
).json();
const s = attrs(st?.data?.[0]);
console.log('\nнастройки:');
console.log('  ', s.company, '|', s.phone, '| скидка', s.discountPercent + '% с ' + s.discountFromDays + ' дн.');
console.log('   адрес:', s.address);
