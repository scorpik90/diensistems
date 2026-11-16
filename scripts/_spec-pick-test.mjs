/** Проверяет, какие ТТХ попадают на карточку по каждой категории */
import fs from 'node:fs';

const seed = JSON.parse(fs.readFileSync('content/seed.json', 'utf8'));

const SPEC_PRIORITY = {
  generator: [/напряжен/i, /активная мощность/i, /нагрузка \d+%|расход топлива|ёмкость бака/i],
  pes: [/мощность/i, /напряжен/i, /нагрузка \d+%|расход топлива|ёмкость бака/i],
  compressor: [/производительн/i, /рабочее давление/i, /привод|тип двигателя/i],
  'compressor-shift': [/производительн/i, /рабочее давление/i, /привод|тип двигателя/i],
  manipulator: [/грузоподъемност|грузоподъёмност/i, /вылет стрелы/i, /длина стрелы|грузовой момент/i],
  used: [/активная мощность|мощность/i, /напряжен/i, /частота/i],
};

function pickSpecs(e, count = 3) {
  const priority = SPEC_PRIORITY[e.category] ?? [/мощность/i, /напряжен/i];
  const rows = [];
  for (const g of e.specGroups ?? []) {
    for (const row of g.rows ?? []) {
      if (rows.some((r) => r.label === row.label)) continue;
      rows.push({ label: row.label, value: row.value });
    }
  }
  const out = [];
  const used = new Set();
  for (const re of priority) {
    if (out.length >= count) break;
    const found = rows.find((r) => re.test(r.label) && !used.has(r.label));
    if (found) { out.push(found); used.add(found.label); }
  }
  for (const r of rows) {
    if (out.length >= count) break;
    if (used.has(r.label)) continue;
    out.push(r); used.add(r.label);
  }
  return out;
}

const seen = new Set();
for (const e of seed.equipment) {
  const specs = pickSpecs(e);
  const key = e.category + '|' + specs.map((s) => s.label).join(',');
  if (seen.has(key)) continue;
  seen.add(key);
  console.log(`\n${e.category} / ${e.model}`);
  for (const s of specs) console.log(`   ${s.label}: ${s.value}`);
  if (specs.length < 3) console.log('   ⚠ меньше трёх характеристик');
}
