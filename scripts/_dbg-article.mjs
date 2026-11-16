const BASE = 'http://127.0.0.1:3100';

const sm = await (await fetch(`${BASE}/sitemap.xml`)).text();
const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
console.log('в sitemap есть /article:', locs.some((l) => l.includes('/article')));

const res = await fetch(`${BASE}/article`, { redirect: 'manual' });
console.log('/article →', res.status, res.headers.get('location') ?? '');
if (res.status === 200) {
  const html = await res.text();
  console.log('  title:', html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
  console.log('  h1:', [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => m[1].replace(/<[^>]+>/g, ' ').trim()));
  console.log('  длина текста:', html.length);
}

/* Ищем, откуда взялся /article */
console.log('\n=== что содержит sitemap вокруг article ===');
const i = sm.indexOf('/article');
if (i > 0) console.log(sm.slice(Math.max(0, i - 200), i + 200));
