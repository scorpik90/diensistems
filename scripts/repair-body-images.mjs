/**
 * Восстановление тегов <img> в текстах статей и страниц.
 *
 *   node scripts/repair-body-images.mjs
 *
 * В двух материалах («Бесщёточный синхронный генератор» и
 * «Доп. оборудование») при переносе в CMS потерялся открывающий тег
 * <img> — остались только атрибуты. Скрипт собирает теги заново,
 * ничего не меняя в тексте.
 *
 * Картинки при этом лежат в медиатеке CMS — пути относительные,
 * публичный адрес подставляет сайт при рендере.
 */
import fs from 'node:fs';

const STRAPI_URL = (process.env.STRAPI_URL ?? 'http://127.0.0.1:1337').replace(/\/$/, '');
const tokens = JSON.parse(fs.readFileSync('.strapi-tokens.json', 'utf8'));
const H = { Authorization: `Bearer ${tokens['genorg-write']}` };
const BASE = `${STRAPI_URL}/api`;

/**
 * Возвращает тег <img> перед «оторванными» атрибутами.
 * Условие: перед src нет открывающего «<» — значит, тег потерялся.
 */
const REPAIR_IMG = /([^<])(\s*)src="(\/uploads\/body_[^"]+)"(\s*alt="[^"]*")?\s*>/g;

/**
 * Возвращает тег <img> там, где потерялся открывающий.
 *
 * Разбираем HTML по «>»: каждый фрагмент — один тег. Если внутри
 * есть src картинки из медиатеки, но сам тег <img> потерян —
 * собираем его заново, сохраняя класс.
 *
 * Идемпотентно: правильный тег пересобирается в себя же.
 */
function repair(html) {
  if (!html) return html;

  const parts = html.split('>');
  const out = parts.map((chunk, idx) => {
    if (idx === parts.length - 1) return chunk; /* хвост после последнего «>» */
    if (!/src="\/uploads\/body_/.test(chunk)) return chunk + '>';

    const lt = chunk.lastIndexOf('<');
    const attrs = (lt >= 0 ? chunk.slice(lt + 1) : chunk).trim();
    /* Класс мог остаться перед потерянным «<img» */
    const before = lt >= 0 ? chunk.slice(0, lt) : '';
    const cls = before.match(/class="[^"]*"/)?.[0] ?? '';
    const rest = attrs.replace(/^img\b/i, '').replace(/\s+/g, ' ').trim();
    const clsPart = cls ? ` ${cls}` : '';
    return `<img${clsPart} ${rest}>`.replace(/\s+/g, ' ');
  });

  return out.join('');
}

const seedPath = 'content/seed.json';
const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

const TARGETS = [
  ['articles', 'besshetochnyjsinhronnyjgenerator'],
  ['pages', 'dopoborudovanie'],
];

for (const [collection, slug] of TARGETS) {
  const list = collection === 'articles' ? seed.articles : seed.pages;
  const rec = list.find((x) => x.slug === slug);
  if (!rec) {
    console.log(`  ! ${slug} не найден в seed`);
    continue;
  }

  const before = rec.bodyHtml;
  rec.bodyHtml = repair(before);
  const imgs = (rec.bodyHtml.match(/<img/g) || []).length;
  console.log(`  ${slug}: img-тегов ${imgs}, изменено: ${before !== rec.bodyHtml}`);

  const res = await fetch(
    `${BASE}/${collection}?filters[slug][$eq]=${encodeURIComponent(slug)}&pagination[pageSize]=1`,
    { headers: H }
  );
  const json = await res.json();
  const item = json?.data?.[0];
  if (!item) {
    console.log('    ! запись в CMS не найдена');
    continue;
  }
  await fetch(`${BASE}/${collection}/${item.documentId ?? item.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...H },
    body: JSON.stringify({ data: { bodyHtml: rec.bodyHtml } }),
  });
  console.log('    ✓ обновлено в CMS');
}

fs.writeFileSync(seedPath, JSON.stringify(seed, null, 2), 'utf8');
console.log('\nобновлён content/seed.json');
