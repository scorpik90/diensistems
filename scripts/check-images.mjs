/**
 * Проверка картинок: все ли файлы, на которые ссылается сайт, реально существуют.
 *
 *   node scripts/check-images.mjs
 *
 * Ловит «битые» <img> — те самые, из-за которых пользователь видел
 * значок разбитой картинки.
 */
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:3100';
const PAGES = [
  '/',
  '/arendageneratorov',
  '/arendakompressorov',
  '/kompressornasmeny',
  '/arendamanipulatora',
  '/mobilnyegeneratory',
  '/prodazhabu',
  '/tsenyinaarendu',
  '/nashiobekty',
  '/poleznoe',
  '/arendadizelnogeneratora100kvt',
  '/arendapes60kvt',
  '/arendacompressoraairmanpds185s',
  '/arendamanipulatorahino300',
  '/generator200kwtkupit',
];

const found = new Set();
for (const p of PAGES) {
  const html = await (await fetch(BASE + p)).text();
  /* Смотрим только реальные атрибуты <img src> и <source srcset>,
     а не весь HTML: в RSC-payload лежат служебные данные. */
  for (const m of html.matchAll(/<img[^>]+src="([^"]+)"/g)) {
    if (m[1].startsWith('/images/')) found.add(m[1]);
  }
  for (const m of html.matchAll(/<source[^>]+srcset="([^"]+)"/g)) {
    for (const u of m[1].split(',')) {
      const clean = u.trim().split(' ')[0];
      if (clean.startsWith('/images/')) found.add(clean);
    }
  }
}

console.log(`уникальных ссылок на изображения: ${found.size}`);

let broken = 0;
for (const src of [...found].sort()) {
  const res = await fetch(BASE + src, { method: 'HEAD' });
  if (!res.ok) {
    broken++;
    console.log(`  ✗ ${res.status} ${src}`);
  }
}

console.log(broken === 0 ? '✓ все изображения на месте' : `✗ битых: ${broken}`);
process.exit(broken === 0 ? 0 : 1);
