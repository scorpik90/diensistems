/** Проверка дублей: отдают ли страницы со слэшем 200 или редирект */
const BASE = 'http://127.0.0.1:3100';

const sm = await (await fetch(`${BASE}/sitemap.xml`)).text();
const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

const withSlash = locs.filter((l) => l.endsWith('/') && l !== 'https://genorg.ru/');
console.log(`URL со слэшем в sitemap: ${withSlash.length}`);

console.log('\n=== что отдаёт сервер ===');
for (const u of withSlash.slice(0, 14)) {
  const path = u.replace('https://genorg.ru', '');
  const res = await fetch(BASE + path, { redirect: 'manual' });
  const loc = res.headers.get('location') ?? '—';
  console.log(`  ${path.padEnd(26)} → ${res.status}  ${loc !== '—' ? '→ ' + loc : ''}`);
}

console.log('\n=== canonical на страницах со слэшем ===');
for (const u of withSlash.slice(0, 4)) {
  const path = u.replace('https://genorg.ru', '');
  const res = await fetch(BASE + path, { redirect: 'manual' });
  if (res.status !== 200) continue;
  const html = await res.text();
  const canon = html.match(/<link rel="canonical" href="([^"]*)"/i)?.[1] ?? '—';
  const title = html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? '—';
  console.log(`  ${path.padEnd(26)} canonical: ${canon}`);
  console.log(`  ${' '.repeat(26)} title: ${title.slice(0, 60)}`);
}
