import fs from 'node:fs';

/* Сверяем атрибуты схемы Strapi с тем, что реально шлёт импорт,
   и добавляем недостающие. Так ловим расхождения до 400-ошибки. */

const COLLECTION = {
  'site-settings': 'site-setting',
  categories: 'category',
  equipment: 'equipment-item',
  'price-tables': 'price-table',
  cases: 'case',
  articles: 'article',
  reviews: 'review',
  pages: 'page',
  redirects: 'redirect',
};

/* Что импорт реально кладёт в каждую коллекцию */
const PAYLOAD = {
  'site-settings': [
    'company', 'legalName', 'phone', 'phoneRaw', 'email', 'address', 'city',
    'foundedYear', 'fleetMW', 'deliveryHours', 'rating', 'ratingCount',
    'workingHours', 'discountFromDays', 'discountPercent', 'yandexReviewsUrl',
  ],
  categories: ['key', 'label', 'slug', 'unit'],
  equipment: [
    'slug', 'category', 'isNew', 'brand', 'categoryLabel', 'title', 'titleFull',
    'model', 'power', 'powerUnit', 'priceValue', 'priceUnit', 'priceRaw',
    'specGroups', 'image', 'imageAlt', 'description', 'legacyUrls',
  ],
  'price-tables': ['index', 'rows'],
  cases: ['slug', 'title', 'kW', 'bodyHtml', 'image', 'legacyUrls'],
  articles: ['slug', 'title', 'bodyHtml', 'excerpt', 'legacyUrls'],
  reviews: ['author', 'rating', 'text', 'date', 'sourceUrl', 'order'],
  pages: ['slug', 'title', 'bodyHtml', 'excerpt', 'kind', 'category', 'legacyUrls'],
  redirects: ['from', 'to', 'reason'],
};

/* Тип атрибута по имени — для новых полей */
const TYPES = {
  yandexReviewsUrl: 'string',
  brand: 'string',
  isNew: 'boolean',
};

const SCHEMA_DIR = 'cms/schemas';
const files = fs.readdirSync(SCHEMA_DIR);

let changed = 0;

for (const [collection, uid] of Object.entries(COLLECTION)) {
  const file = files.find((f) => f.replace('.json', '') === uid || f.replace('.json', '') === collection);
  if (!file) {
    console.log(`  ! нет схемы для ${collection}`);
    continue;
  }
  const p = `${SCHEMA_DIR}/${file}`;
  const j = JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));

  const missing = PAYLOAD[collection].filter((k) => !(k in j.attributes));
  for (const key of missing) {
    j.attributes[key] = {
      type: TYPES[key] ?? 'string',
      description: `Добавлено автоматически при сверке схемы с импортом (${key})`,
    };
    console.log(`  + ${collection}.${key}`);
    changed++;
  }

  if (missing.length) {
    fs.writeFileSync(p, JSON.stringify(j, null, 2), 'utf8');
  }
}

console.log(changed ? `\nДобавлено полей: ${changed}. Перезапустите Strapi.` : '\nСхемы в порядке.');
