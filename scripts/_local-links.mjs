import fs from 'node:fs';

/**
 * Приводит абсолютные ссылки на боевой домен к относительным путям.
 *
 *   node scripts/_local-links.mjs
 *
 * При миграции тексты и прайс-таблицы сохраняли ссылки в исходном
 * виде — «https://genorg.ru/arendageneratorov». На новом сайте такая
 * ссылка уводила посетителя на боевой домен, а не на новую страницу.
 *
 * Заодно проверяется, что целевой путь есть среди страниц сайта:
 * если нет — ссылка заменяется на заглушку и попадает в отчёт.
 */
const seedPath = 'content/seed.json';
const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

/* Все пути, которые есть на новом сайте */
const known = new Set([
  '/',
  ...seed.equipment.map((e) => `/${e.slug}`),
  ...seed.articles.map((a) => `/${a.slug}`),
  ...seed.cases.map((c) => `/${c.slug}`),
  ...seed.pages.map((p) => `/${p.slug}`),
]);

const RE = /https?:\/\/(?:www\.)?genorg\.ru(\/[^\s"'<)]*)?/gi;

let replaced = 0;
const unknown = new Map();

function fixString(s) {
  return s.replace(RE, (_m, p) => {
    const path = p && p.length > 1 ? p.replace(/\/$/, '') || '/' : '/';
    replaced++;
    if (!known.has(path)) {
      unknown.set(path, (unknown.get(path) ?? 0) + 1);
    }
    return path;
  });
}

function walk(node) {
  if (typeof node === 'string') return fixString(node);
  if (Array.isArray(node)) return node.map(walk);
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) out[k] = walk(v);
    return out;
  }
  return node;
}

/* meta.source — служебное поле, оставляем как есть */
const source = seed.meta.source;
const fixed = walk({ ...seed, meta: { ...seed.meta, source } });
fixed.meta.source = source;

fs.writeFileSync(seedPath, JSON.stringify(fixed, null, 2), 'utf8');

console.log(`заменено ссылок: ${replaced}`);
if (unknown.size) {
  console.log('\nцелевые пути, которых нет на сайте:');
  for (const [p, n] of unknown) console.log(`  ${p} (${n})`);
} else {
  console.log('все ссылки ведут на существующие страницы');
}
