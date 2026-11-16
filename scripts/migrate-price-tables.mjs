/**
 * Пересобирает прайс-таблицы с боевого сайта с сохранением
 * объединения ячеек (colspan / rowspan).
 *
 *   node scripts/migrate-price-tables.mjs
 *
 * Раньше при миграции атрибуты <td> вырезались, и структура таблиц
 * терялась: например в таблице кранов-манипуляторов заголовок
 * «Грузоподъемность тонн» объединяет две колонки (грузоподъёмность
 * шасси и крана), а без colspan подшапка «ШАССИ | КРАН» съезжала
 * на колонку влево.
 *
 * Здесь парсится исходный HTML боевого сайта, и в content/seed.json
 * попадают точные тексты, ссылки и объединения ячеек.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ORIGIN = 'https://genorg.ru';
const UA = 'Mozilla/5.0 (compatible; genorg-migration/2.0)';

const decode = (s) =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

const text = (html) => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

const attr = (tag, name) => {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i'));
  return m ? m[1].trim() : null;
};

const num = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : undefined;
};

/**
 * Ссылка боевого сайта → относительный путь нового сайта.
 * «https://genorg.ru/arendageneratorov» → «/arendageneratorov»
 */
function toLocalPath(href) {
  try {
    const u = new URL(href, ORIGIN);
    if (!/(^|\.)genorg\.ru$/i.test(u.hostname)) return href;
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return href.startsWith('/') ? href : `/${href}`;
  }
}

/* Разбор одной таблицы */
function parseTable(tableHtml) {
  const rows = [...tableHtml.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((m) => m[0]);

  return rows.map((row) => {
    const cells = [...row.matchAll(/<(td|th)([^>]*)>([\s\S]*?)<\/\1>/gi)].map((m) => {
      const content = m[3];
      const link = content.match(/<a[^>]+href=["']([^"']+)["']/i)?.[1] ?? null;
      const strong = content.match(/<b[^>]*>([\s\S]*?)<\/b>/i)?.[1] ?? null;
      const cls = attr(m[0], 'class');

      const cell = {
        text: text(content),
        strong: strong ? text(strong) : null,
        /* Ссылка приводится к относительному пути: абсолютная
           ссылка на боевой домен уводила бы посетителя со
           нового сайта на старый. */
        link: link ? toLocalPath(link) : null,
      };

      const colspan = num(attr(m[2], 'colspan'));
      const rowspan = num(attr(m[2], 'rowspan'));
      if (colspan) cell.colspan = colspan;
      if (rowspan) cell.rowspan = rowspan;

      /* Ячейка, выделенная классом hl, — акцентная */
      if (cls && /hl/.test(cls)) cell.strong = cell.strong ?? cell.text;

      return cell;
    });

    /* Пустая строка-заглушка (все ячейки заняты rowspan) — пропускаем */
    return cells.filter((c) => c.text || c.colspan || c.rowspan);
  }).filter((r) => r.length);
}

/* ─── Загрузка и разбор ─── */

const res = await fetch(`${ORIGIN}/tsenyinaarendu`, { headers: { 'User-Agent': UA } });
const html = await res.text();
console.log('боевой сайт:', res.status, html.length, 'байт');

const tables = [...html.matchAll(/<table[\s\S]*?<\/table>/gi)].map((m) => m[0]);
console.log('таблиц найдено:', tables.length);

const seedPath = path.join(ROOT, 'content', 'seed.json');
const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

const priceTables = tables.map((t, i) => {
  const rows = parseTable(t);
  console.log(`\n=== таблица ${i}: ${rows.length} строк`);
  for (const [ri, row] of rows.entries()) {
    if (ri > 3) break;
    console.log(
      `   ${row
        .map((c) => `[${c.text.slice(0, 28)}${c.colspan ? `+${c.colspan}` : ''}${c.rowspan ? `^${c.rowspan}` : ''}]`)
        .join(' ')}`
    );
  }
  return { index: i, rows };
});

seed.priceTables = priceTables;
fs.writeFileSync(seedPath, JSON.stringify(seed, null, 2), 'utf8');
console.log('\nобновлён content/seed.json');
console.log('дальше: node scripts/import-to-strapi.mjs --reset');
