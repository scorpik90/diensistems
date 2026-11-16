/**
 * Проверка картинок: все ли файлы, на которые ссылается сайт, реально доступны.
 *
 *   node scripts/check-images.mjs
 *
 * Фотографии лежат в медиатеке Strapi, поэтому проверяем не файлы
 * в public/, а то, что CMS отдаёт по ссылкам из вёрстки.
 *
 * Ловит «битые» <img> — те самые, из-за которых пользователь видел
 * значок разбитой картинки.
 */
const BASE = 'http://127.0.0.1:3100';

/* Обходим все страницы из sitemap */
const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
const PAGES = [
  ...new Set(
    [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname)
  ),
];

const found = new Set();
for (const p of PAGES) {
  const html = await (await fetch(BASE + p)).text();
  /* Смотрим только реальные атрибуты <img src> и <source srcset>,
     а не весь HTML: в RSC-payload лежат служебные данные. */
  for (const m of html.matchAll(/<img[^>]+src="([^"]+)"/g)) {
    if (m[1].startsWith('http')) found.add(m[1]);
  }
  for (const m of html.matchAll(/<img[^>]+srcset="([^"]+)"/g)) {
    for (const u of m[1].split(',')) {
      const clean = u.trim().split(' ')[0];
      if (clean.startsWith('http')) found.add(clean);
    }
  }
}

console.log(`уникальных ссылок на изображения: ${found.size}`);

/* Отдельно — то, что осталось в самом проекте (иконки, манифест) */
const local = new Set();
for (const p of PAGES) {
  const html = await (await fetch(BASE + p)).text();
  for (const m of html.matchAll(/<img[^>]+src="(\/[^"]+)"/g)) local.add(m[1]);
}
console.log(`локальных файлов в вёрстке: ${local.size}`);

let broken = 0;
for (const src of [...found].sort()) {
  const res = await fetch(src, { method: 'HEAD' });
  if (!res.ok) {
    broken++;
    console.log(`  ✗ ${res.status} ${src}`);
  }
}
for (const src of [...local].sort()) {
  const res = await fetch(BASE + src, { method: 'HEAD' });
  if (!res.ok) {
    broken++;
    console.log(`  ✗ ${res.status} ${src}`);
  }
}

console.log(broken === 0 ? '✓ все изображения на месте' : `✗ битых: ${broken}`);

/* ── У карточек позиций фото должно быть из CMS, а не заглушка ── */
import fs from 'node:fs';

const tokens = JSON.parse(fs.readFileSync('.strapi-tokens.json', 'utf8'));
const eqRes = await (
  await fetch('http://127.0.0.1:1337/api/equipment?pagination[pageSize]=200&populate=*', {
    headers: { Authorization: `Bearer ${tokens['genorg-read']}` },
  })
).json();

let placeholders = 0;
let checked = 0;
for (const e of eqRes.data ?? []) {
  if (!e.image) continue;
  checked++;
  const html = await (await fetch(`${BASE}/${e.slug}`)).text();
  const hasPhoto = /class="product__media"[^>]*>\s*<img/.test(html);
  const hasStub = html.includes('ph--product');
  if (!hasPhoto && hasStub) {
    placeholders++;
    console.log(`  ✗ ${e.slug}: вместо фото — заглушка`);
  }
}

console.log(
  placeholders === 0
    ? `✓ у всех ${checked} позиций с фото фото подставлено`
    : `✗ позиций с заглушкой вместо фото: ${placeholders}`
);

process.exit(broken === 0 && placeholders === 0 ? 0 : 1);
