/**
 * Сбор отзывов с Яндекс.Карт.
 *
 *   node scripts/fetch-yandex-reviews.mjs
 *
 * Яндекс отдаёт отзывы JSON-блоком прямо в HTML публичной страницы
 * (неофициальный, но стабильный формат). Разбираем его без API-ключа.
 *
 * Сортировка: сначала по оценке (5 → 1), при равенстве — по дате,
 * свежие выше. Собственные отзывы компании и её сотрудников не показываем.
 *
 * Фотографии из отзывов НЕ храним у себя — сохраняем прямые ссылки
 * на CDN Яндекса (avatars.mds.yandex.net). Так мы не нарушаем права
 * на чужие снимки и не раздуваем свой диск.
 *
 * Результат: content/reviews.json → импортируется в CMS.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const ORG_ID = '1088163471';
const REVIEWS_URL = `https://yandex.ru/maps/org/dien_sistems/${ORG_ID}/reviews/?ll=37.351851%2C55.951404&z=16`;
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** Вырезает JSON-массив по балансу скобок (в строке регулярка не справится) */
function extractJsonArray(html, key) {
  const start = html.indexOf(key);
  if (start < 0) return null;
  const from = start + key.length;

  let depth = 0, inStr = false, esc = false;
  for (let i = from; i < html.length; i++) {
    const c = html[i];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === '"') inStr = !inStr;
    if (inStr) continue;
    if (c === '[') depth++;
    else if (c === ']') {
      depth--;
      if (depth === 0) return html.slice(from, i + 1);
    }
  }
  return null;
}

const res = await fetch(REVIEWS_URL, { headers: { 'User-Agent': UA } });
if (!res.ok) {
  console.error('Яндекс.Карты недоступны: HTTP', res.status);
  process.exit(1);
}
const html = await res.text();

const raw = extractJsonArray(html, '"reviews":');
if (!raw) {
  console.error('В HTML не найден блок с отзывами.');
  process.exit(1);
}
const all = JSON.parse(raw);

/* Собственные отзывы компании и её сотрудников не показываем.
   businessId у всех отзывов равен id организации — по нему отфильтровать
   нельзя, поэтому сверяем publicId автора и служебные имена. */
const OWNER_IDS = new Set(['scorpik90']);
const OWNER_NAMES = /^(поддержка|support|диэн|дэн)/i;

const prepared = all
  .filter((r) => r.rating > 0 && !OWNER_IDS.has(r.author?.publicId ?? ''))
  .filter((r) => !OWNER_NAMES.test((r.author?.name ?? '').trim()))
  .map((r) => ({
    author: (r.author?.name ?? 'Клиент').trim(),
    rating: Number(r.rating),
    text: (r.text ?? '').replace(/\s+/g, ' ').trim(),
    date: (r.updatedTime ?? r.date ?? '').slice(0, 10),
    sourceUrl: REVIEWS_URL,
    photoUrls: (r.photos ?? [])
      .map((p) => p?.urlTemplate)
      .filter(Boolean)
      .map((t) => t.replace('{size}', 'XXXL')),
  }))
  .sort((a, b) => b.rating - a.rating || b.date.localeCompare(a.date));

console.log(`отзывов получено: ${prepared.length}`);

/* Фотографии оставляем на CDN Яндекса — просто сохраняем ссылки */
let photoCount = 0;
for (const r of prepared) {
  r.photos = r.photoUrls.slice(0, 3);
  delete r.photoUrls;
  photoCount += r.photos.length;
  if (r.photos.length) {
    console.log(`  фото: ${r.author} — ${r.photos.length}`);
  }
}
console.log(`ссылок на фотографии: ${photoCount}`);

const top = prepared.slice(0, 2);
console.log(`\nв витрину идут ${top.length}:`);
for (const r of top) {
  console.log(`  ${r.rating}★ ${r.date} ${r.author}${r.photos?.length ? ` (фото: ${r.photos.length})` : ''}`);
}

const out = {
  _comment:
    'Отзывы с Яндекс.Карт. Обновляются скриптом fetch-yandex-reviews.mjs. ' +
    'На странице показываются два лучших: сначала по оценке, при равенстве — по дате. ' +
    'Фотографии скачаны и оптимизированы локально.',
  orgId: ORG_ID,
  url: REVIEWS_URL,
  total: prepared.length,
  reviews: top,
  all: prepared,
};

fs.writeFileSync(path.join(ROOT, 'content', 'reviews.json'), JSON.stringify(out, null, 2), 'utf8');
console.log('\nзаписано: content/reviews.json');
