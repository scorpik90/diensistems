/**
 * Аудит SEO и GEO: сниппеты, структура, разметка, индексируемость.
 *
 *   node scripts/_seo-audit.mjs
 */
import fs from 'node:fs';

const BASE = process.env.SITE_URL ?? 'http://127.0.0.1:3100';

/* ─── 1. Собираем sitemap ─── */

const sm = await (await fetch(`${BASE}/sitemap.xml`)).text();
const urls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
console.log(`=== sitemap: ${urls.length} URL ===`);

const robots = await (await fetch(`${BASE}/robots.txt`)).text();
console.log('=== robots.txt ===');
console.log(robots.split('\n').map((l) => '  ' + l).join('\n'));

/* ─── 2. Собираем сниппеты со всех страниц ─── */

const rows = [];
for (const u of urls) {
  const html = await (await fetch(u)).text();
  const title = html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? '';
  const desc = html.match(/<meta name="description" content="([^"]*)"/i)?.[1] ?? '';
  const canonical = html.match(/<link rel="canonical" href="([^"]*)"/i)?.[1] ?? '';
  const ogTitle = html.match(/<meta property="og:title" content="([^"]*)"/i)?.[1] ?? '';
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) =>
    m[1].replace(/<[^>]+>/g, '').trim()
  );
  const ld = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].map(
    (m) => {
      try {
        const j = JSON.parse(m[1]);
        const arr = Array.isArray(j) ? j : [j];
        return arr.map((x) => x['@type']).join(',');
      } catch {
        return 'BROKEN JSON';
      }
    }
  );
  const h2 = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].length;
  const imgs = (html.match(/<img/gi) ?? []).length;
  const noAlt = (html.match(/<img(?![^>]*\salt=)[^>]*>/gi) ?? []).length;
  const words = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const wordCount = words.split(' ').length;

  rows.push({
    path: u.replace(BASE, '') || '/',
    title,
    titleLen: title.length,
    desc,
    descLen: desc.length,
    canonical,
    h1s,
    h2,
    ld,
    imgs,
    noAlt,
    words: wordCount,
  });
}

/* ─── 3. Отчёт ─── */

console.log('\n=== СНИППЕТЫ ===');
for (const r of rows) {
  const flags = [];
  if (r.titleLen > 65) flags.push(`title длинный (${r.titleLen})`);
  if (r.titleLen < 25) flags.push(`title короткий (${r.titleLen})`);
  if (r.descLen > 180) flags.push(`description длинный (${r.descLen})`);
  if (r.descLen < 70) flags.push(`description короткий (${r.descLen})`);
  if (r.h1s.length !== 1) flags.push(`h1: ${r.h1s.length}`);
  if (r.noAlt) flags.push(`img без alt: ${r.noAlt}`);
  if (r.ld.includes('BROKEN JSON')) flags.push('битый JSON-LD');
  if (r.words < 150) flags.push(`мало текста (${r.words} слов)`);

  console.log(`\n  ${r.path}`);
  console.log(`    title (${r.titleLen}): ${r.title}`);
  console.log(`    desc  (${r.descLen}): ${r.desc.slice(0, 110)}`);
  console.log(`    h1: ${r.h1s.join(' | ') || '—'}`);
  console.log(`    h2: ${r.h2} · слов: ${r.words} · img: ${r.imgs} · JSON-LD: ${r.ld.join(', ') || '—'}`);
  if (flags.length) console.log(`    ⚠ ${flags.join(' · ')}`);
}

/* ─── 4. Дубли и пробелы ─── */

console.log('\n=== ДУБЛИ ===');
const byTitle = new Map();
const byDesc = new Map();
for (const r of rows) {
  byTitle.set(r.title, [...(byTitle.get(r.title) ?? []), r.path]);
  byDesc.set(r.desc, [...(byDesc.get(r.desc) ?? []), r.path]);
}
for (const [t, list] of byTitle) if (list.length > 1) console.log(`  title повторяется: ${list.join(', ')}`);
for (const [d, list] of byDesc) if (list.length > 1) console.log(`  description повторяется: ${list.join(', ')}`);

console.log('\n=== ТИПЫ РАЗМЕТКИ ===');
const types = new Map();
for (const r of rows) for (const t of r.ld.split(',')) types.set(t, (types.get(t) ?? 0) + 1);
for (const [t, n] of [...types].sort((a, b) => b[1] - a[1])) console.log(`  ${t}: ${n}`);

/* ─── 5. Покрытие запросов ─── */

console.log('\n=== ПОКРЫТИЕ ЗАПРОСОВ ===');
const queries = [
  'аренда дизельного генератора', 'аренда генератора', 'генератор в аренду',
  'аренда дизель-генератора', 'ДГУ аренда', 'аренда электростанции',
  'аренда компрессора', 'компрессор в аренду', 'аренда компрессорной станции',
  'аренда крана манипулятора', 'кран манипулятор в аренду',
  'аренда передвижной электростанции', 'ПЭС аренда',
  'аренда генератора на смену', 'аренда генератора в Москве',
  'аренда генератора с оператором', 'аренда генератора с доставкой',
  'аренда шумозащитного ограждения', 'аренда дизельного топлива',
  'продажа б/у генератора', 'купить генератор б/у', 'аренда экскаватора',
  'аренда дизельного генератора цена', 'стоимость аренды генератора',
];
for (const q of queries) {
  const hits = rows.filter((r) => {
    const hay = (r.title + ' ' + r.desc + ' ' + r.h1s.join(' ')).toLowerCase();
    return hay.includes(q.toLowerCase());
  });
  console.log(`  ${hits.length ? '✓' : '✗'} «${q}» → ${hits.map((h) => h.path).slice(0, 3).join(', ') || '—'}`);
}
