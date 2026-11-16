/**
 * Проверка правок подвала и отступов в отзывах.
 *
 *   node scripts/_check-footer.mjs
 */
const BASE = process.env.SITE_URL ?? 'http://127.0.0.1:3100';

const html = await (await fetch(`${BASE}/`)).text();

/* Разбираем подвал регулярками — страница статическая */
const footer = html.slice(html.indexOf('<footer'));
if (footer < 0) {
  console.log('✗ подвал не найден');
  process.exit(1);
}

const lists = [...footer.matchAll(/<h4>([^<]+)<\/h4>\s*<ul[^>]*>([\s\S]*?)<\/ul>/g)];
let bad = 0;

for (const [, title, body] of lists) {
  const items = [...body.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map((m) => ({
    href: m[1],
    label: m[2].trim(),
  }));
  console.log(`\n=== ${title}`);
  for (const i of items) console.log(`   ${i.label.padEnd(26)} ${i.href}`);

  const price = items.find((i) => i.href === '/tsenyinaarendu');
  if (title === 'Услуги' && price) {
    bad++;
    console.log('   ✗ «Прайс-лист» остался в блоке «Услуги»');
  }
  if (title === 'Компания' && !price) {
    bad++;
    console.log('   ✗ «Прайс-лист» не перенесён в блок «Компания»');
  }
}

console.log(bad === 0 ? '\n✓ Подвал: «Прайс-лист» в блоке «Компания».' : `\n✗ Проблем: ${bad}`);
