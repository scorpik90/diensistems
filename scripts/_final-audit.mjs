/**
 * Финальный аудит: ошибки в консоли, битые ссылки, доступность.
 *
 *   node scripts/_final-audit.mjs
 */
const BASE = process.env.SITE_URL ?? 'http://127.0.0.1:3100';

const PAGES = [
  '/',
  '/arendageneratorov',
  '/arendakompressorov',
  '/arendamanipulatora',
  '/mobilnyegeneratory',
  '/kompressornasmeny',
  '/prodazhabu',
  '/tsenyinaarendu',
  '/nashiobekty',
  '/dostavka',
  '/poleznoe',
  '/contacts',
  '/dopoborudovanie',
  '/politika-obrabotki-personalnyh-dannyh',
  '/arendadizelnogogeneratora60kvt',
  '/arendacompressoraairmanpds185sc',
  '/generator250kwtkupit',
  '/arendageneratora100kvtdlyastroitelstvasportivnogokompleksavhimkah',
];

let bad = 0;

console.log('=== страницы ===');
for (const p of PAGES) {
  const r = await fetch(BASE + p);
  const html = await r.text();

  const issues = [];

  /* Заголовки */
  const h1 = (html.match(/<h1[^>]*>/gi) ?? []).length;
  if (h1 !== 1) issues.push(`h1: ${h1}`);

  /* Описание и canonical */
  if (!/<meta name="description"/i.test(html)) issues.push('нет description');
  if (!/<link rel="canonical"/i.test(html)) issues.push('нет canonical');
  if (!/<meta name="viewport"/i.test(html)) issues.push('нет viewport');

  /* lang */
  if (!/<html lang="ru"/i.test(html)) issues.push('нет lang="ru"');

  /* Пустые ссылки и заглушки.
     Проверяем только видимый текст: служебные RSC-данные Next
     содержат «$undefined», это норма. */
  const visible = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ');
  if (/href=""/.test(html)) issues.push('пустой href');
  if (/>\s*(undefined|NaN)\s*</.test(visible)) issues.push('undefined/NaN в тексте');
  if (/\{\{[^}]+\}\}/.test(visible)) issues.push('незаполненный плейсхолдер {{…}}');

  /* Битые внутренние ссылки */
  const links = [...new Set([...html.matchAll(/href="(\/[^"#]*)"/g)].map((m) => m[1]))];
  const broken = [];
  for (const l of links) {
    if (l.startsWith('/_next') || l.startsWith('/images') || l.startsWith('/favicon')) continue;
    const rr = await fetch(BASE + l, { redirect: 'manual' });
    if (rr.status !== 200) broken.push(`${l}→${rr.status}`);
  }
  if (broken.length) issues.push('битые ссылки: ' + broken.slice(0, 3).join(', '));

  /* Alt у картинок */
  const noAlt = (html.match(/<img(?![^>]*\salt=)[^>]*>/gi) ?? []).length;
  if (noAlt) issues.push(`img без alt: ${noAlt}`);

  const status = issues.length ? '✗' : '✓';
  if (issues.length) bad++;
  console.log(`  ${status} ${p}  ${issues.join(' | ')}`);
}

console.log(`\nстраниц с замечаниями: ${bad}`);
console.log(bad === 0 ? '✓ Аудит чистый.' : '✗ Есть замечания.');
