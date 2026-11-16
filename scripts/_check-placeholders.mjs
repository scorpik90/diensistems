/**
 * Проверка подстановок в текстах.
 *
 *   node scripts/_check-placeholders.mjs
 *
 * В редактируемых текстах CMS используются шаблоны вида {price},
 * {count}. Если подстановка не сработала, посетитель увидит в тексте
 * «{price}» — это ловится здесь.
 *
 * Обходятся все страницы из sitemap.
 */
const BASE = 'http://127.0.0.1:3100';

/** Известные имена подстановок — они не считаются ошибкой */
const KNOWN = new Set([
  'count', 'countWord', 'models', 'powerRange', 'minPrice', 'priceUnit', 'priceLong',
  'delivery', 'brands', 'fleetMW', 'discountPercent', 'discountFromDays', 'foundedYear',
  'years', 'year', 'company', 'legalName', 'phone', 'email', 'address', 'workingHours',
  'deliveryHours', 'headroom', 'model', 'kW', 'kw', 'days', 'price', 'title', 'brand',
  'brandCount', 'itemWord', 'modelWord',
]);

const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

const problems = [];

for (const url of urls) {
  const html = await (await fetch(url)).text();
  /* Текст без тегов: проверяем то, что видит посетитель */
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ');

  const found = [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  for (const name of found) {
    if (KNOWN.has(name)) continue;
    problems.push(`${url}: {${name}}`);
  }
}

console.log(`страниц проверено: ${urls.length}`);

if (problems.length) {
  console.log(`✗ неподставленных шаблонов: ${problems.length}`);
  for (const p of problems.slice(0, 30)) console.log(`   · ${p}`);
  process.exit(1);
}

console.log('✓ все шаблоны подставлены');
