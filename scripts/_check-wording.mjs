/** Проверка формулировок на страницах каталогов */
const BASE = 'http://127.0.0.1:3100';

const CATS = [
  '/arendageneratorov',
  '/mobilnyegeneratory',
  '/arendakompressorov',
  '/kompressornasmeny',
  '/arendamanipulatora',
  '/prodazhabu',
];

for (const p of CATS) {
  const html = await (await fetch(BASE + p)).text();

  const head = html.match(/<div class="head">([\s\S]*?)<\/div>/)?.[1] ?? '';
  const headText = head.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const answer = html.match(/<p class="answer__text">([\s\S]*?)<\/p>/)?.[1] ?? '';
  const answerText = answer.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  const facts = [...html.matchAll(/<dt>([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/g)].map(
    (m) => `${m[1].replace(/<[^>]+>/g, '').trim()}: ${m[2].replace(/<[^>]+>/g, '').trim()}`
  );

  const h2s = [...html.matchAll(/<h2 class="section__h2">([\s\S]*?)<\/h2>/g)].map((m) =>
    m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  );
  const note = html.match(/<p class="answer__note">([\s\S]*?)<\/p>/)?.[1]?.replace(/<[^>]+>/g, '').trim();

  console.log(`\n=== ${p}`);
  console.log(`  в шапке: ${headText.slice(0, 120)}`);
  console.log(`  ответ: ${answerText}`);
  console.log('  факты:');
  facts.forEach((f) => console.log(`    · ${f}`));
  console.log(`  h2: ${h2s.join(' | ')}`);
  console.log(`  сноска: ${note ?? '—'}`);
}
