/** Проверка разбора прайс-таблиц: объединения, шапка, вывод ячеек */
import fs from 'node:fs';

const seed = JSON.parse(fs.readFileSync('content/seed.json', 'utf8'));

const isSpanning = (row) => row.some((c) => (c.colspan ?? 1) > 1 || (c.rowspan ?? 1) > 1);
const isDataRow = (row) => {
  if (row.some((c) => c.link)) return true;
  if (isSpanning(row)) return false;
  return row.some((c) => /^\s*\d/.test(c.text));
};

const cellText = (c) => {
  if (!c.strong) return c.text;
  if (c.text === c.strong) return c.strong;
  if (c.text.startsWith(c.strong)) return c.text;
  return c.strong;
};

let bad = 0;

for (const t of seed.priceTables) {
  const rows = t.rows ?? [];
  const firstData = rows.findIndex(isDataRow);
  const head = firstData === -1 ? rows : rows.slice(0, firstData);
  const body = firstData === -1 ? [] : rows.slice(firstData);

  console.log(`\n=== таблица ${t.index}: ${rows.length} строк (шапка ${head.length}, данных ${body.length})`);
  for (const [ri, row] of rows.entries()) {
    const mark = ri < head.length ? 'Ш' : 'Д';
    console.log(
      `  ${mark} ${row
        .map((c) => `[${cellText(c).slice(0, 24)}${c.colspan ? `+${c.colspan}` : ''}${c.rowspan ? `^${c.rowspan}` : ''}]`)
        .join(' ')}`
    );
  }

  /* Ширина таблицы: считаем максимум по строкам с учётом объединений */
  const width = (row, idx) => {
    let w = 0;
    for (const c of row) {
      w += c.colspan ?? 1;
    }
    return w;
  };
  const headWidth = head.reduce((m, r) => Math.max(m, width(r)), 0);
  const bodyWidth = body.reduce((m, r) => Math.max(m, width(r)), 0);
  console.log(`  ширина шапки: ${headWidth}, данных: ${bodyWidth}`);
  if (headWidth !== bodyWidth && bodyWidth > 0) {
    bad++;
    console.log('  ✗ ширины не совпадают');
  }
}

console.log(bad === 0 ? '\n✓ Таблицы согласованы.' : `\n✗ Проблем: ${bad}`);
