/** Содержимое GEO-блока «краткий ответ» и фактов */
const BASE = 'http://127.0.0.1:3100';

for (const p of ['/arendageneratorov', '/arendakompressorov', '/arendamanipulatora', '/prodazhabu']) {
  const html = await (await fetch(BASE + p)).text();

  const answerBlock = html.match(/<div class="answer">([\s\S]*?)<dl class="answer__facts">([\s\S]*?)<\/dl>/);
  const answer = answerBlock
    ? answerBlock[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    : '— нет блока —';
  const facts = answerBlock
    ? [...answerBlock[2].matchAll(/<dt>([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/g)].map(
        (m) => `${m[1].replace(/<[^>]+>/g, '').trim()}: ${m[2].replace(/<[^>]+>/g, '').trim()}`
      )
    : [];

  console.log(`\n=== ${p}`);
  console.log(`  Ответ: ${answer}`);
  console.log('  Факты:');
  facts.forEach((f) => console.log(`    · ${f}`));
}
