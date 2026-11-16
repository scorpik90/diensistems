/** Проверка: JSON-LD на страницах и дубли в sitemap */
const BASE = 'http://127.0.0.1:3100';

console.log('=== JSON-LD по страницам ===');
for (const p of ['/', '/arendageneratorov', '/arendakompressorov', '/tsenyinaarendu', '/contacts', '/arendadizelnogogeneratora60kvt']) {
  const html = await (await fetch(BASE + p)).text();
  const re = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  const found = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      const j = JSON.parse(m[1]);
      const arr = Array.isArray(j) ? j : [j];
      found.push(arr.map((x) => x['@type']).join('+'));
    } catch (e) {
      found.push('BROKEN: ' + e.message.slice(0, 60));
    }
  }
  console.log(`  ${p}: ${found.length ? found.join(', ') : '— НЕТ'}`);
}

console.log('\n=== sitemap: дубли и структура ===');
const sm = await (await fetch(`${BASE}/sitemap.xml`)).text();
const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
console.log(`  всего URL: ${locs.length}`);
const norm = locs.map((l) => l.replace(/\/$/, '') || '/');
const dupes = norm.filter((l, i) => norm.indexOf(l) !== i);
console.log(`  дубли: ${dupes.length ? [...new Set(dupes)].join(', ') : 'нет'}`);
console.log(`  с https://genorg.ru: ${locs.filter((l) => l.startsWith('https://genorg.ru')).length}`);
console.log(`  с другим доменом: ${locs.filter((l) => !l.startsWith('https://genorg.ru')).slice(0, 5).join(', ') || 'нет'}`);
console.log(`  lastmod: ${(sm.match(/<lastmod>/g) ?? []).length}`);
console.log(`  changefreq: ${(sm.match(/<changefreq>/g) ?? []).length}`);
console.log(`  priority: ${(sm.match(/<priority>/g) ?? []).length}`);

console.log('\n=== sitemap.xml (начало) ===');
console.log(sm.slice(0, 700));
