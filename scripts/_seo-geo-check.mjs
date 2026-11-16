/** Проверка SEO/GEO: sitemap, robots, llms.txt, JSON-LD, блоки ответов */
const BASE = 'http://127.0.0.1:3100';

console.log('=== 1. sitemap ===');
const sm = await (await fetch(`${BASE}/sitemap.xml`)).text();
const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
console.log(`  URL: ${locs.length}, уникальных: ${new Set(locs).size}`);
console.log(`  дублей: ${locs.length - new Set(locs).size}`);
const lastmods = [...sm.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]);
console.log(`  разных lastmod: ${new Set(lastmods).size} из ${lastmods.length}`);

console.log('\n=== 2. robots.txt ===');
console.log((await (await fetch(`${BASE}/robots.txt`)).text()).split('\n').filter(Boolean).map((l) => '  ' + l).join('\n'));

console.log('\n=== 3. llms.txt ===');
const llms = await fetch(`${BASE}/llms.txt`);
const llmsText = await llms.text();
console.log(`  статус: ${llms.status}, ${llmsText.length} символов, ${llmsText.split('\n').length} строк`);
console.log('  начало:');
console.log(llmsText.split('\n').slice(0, 5).map((l) => '    ' + l).join('\n'));

console.log('\n=== 4. Разметка и GEO-блоки по страницам ===');
for (const p of ['/', '/arendageneratorov', '/arendakompressorov', '/arendamanipulatora', '/prodazhabu']) {
  const html = await (await fetch(BASE + p)).text();

  const types = [];
  const re = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      const j = JSON.parse(m[1]);
      for (const x of Array.isArray(j) ? j : [j]) types.push(x['@type']);
    } catch (e) {
      types.push('BROKEN');
    }
  }

  const answer = html.match(/<div class="answer">([\s\S]*?)<\/div>\s*<dl/s)?.[1] ?? '';
  const answerText = answer.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const facts = (html.match(/class="answer__facts"/g) ?? []).length;
  const faqItems = (html.match(/class="faq__item"/g) ?? []).length;
  const h2s = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map((x) =>
    x[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  );

  console.log(`\n  ${p}`);
  console.log(`    JSON-LD: ${types.join(', ') || '—'}`);
  console.log(`    «краткий ответ»: ${answerText ? answerText.slice(0, 95) + '…' : 'нет'}`);
  console.log(`    блок фактов: ${facts ? 'да' : 'нет'} · FAQ-пунктов: ${faqItems}`);
  console.log(`    h2: ${h2s.length ? h2s.join(' | ').slice(0, 100) : 'нет'}`);
}
