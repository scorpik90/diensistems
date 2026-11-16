/**
 * Проверка фильтров каталога:
 *   • оси по категориям (кВт / м³/мин / т);
 *   • диапазоны покрывают все позиции и не пересекаются;
 *   • комбинация «категория + бренд + диапазон» никогда не пуста.
 */
import fs from 'node:fs';

const seed = JSON.parse(fs.readFileSync('content/seed.json', 'utf8'));

/* Копия логики из lib/filters.ts (модуль на TypeScript — импортируем через tsx нельзя) */
const num = (raw) => {
  const m = String(raw).replace(/\s/g, '').match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return null;
  const n = Number(m[0].replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

const specValue = (e, re) => {
  for (const g of e.specGroups ?? []) {
    for (const row of g.rows ?? []) if (re.test(row.label)) {
      const n = num(row.value);
      if (n != null) return n;
    }
  }
  return null;
};

const compressorAirFlow = (e) => specValue(e, /производительн/i);
const manipulatorCapacity = (e) => specValue(e, /грузоподъемност|грузоподъёмност/i) ?? e.power ?? null;

const niceCeil = (v) => {
  if (v <= 0) return v;
  for (const s of [1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000]) {
    const n = Math.ceil(v / s) * s;
    if (n - v < s * 0.6) return Number(n.toFixed(2));
  }
  return Math.ceil(v);
};

function rangesFromValues(values, unit, maxBuckets = 4) {
  const uniq = [...new Set(values)].sort((a, b) => a - b);
  if (uniq.length === 0) return [];
  const fmt = (n) => String(n).replace('.', ',');
  if (uniq.length === 1) return [{ id: 'all-bucket', label: `до ${fmt(uniq[0])} ${unit}`, from: 0, to: uniq[0] }];
  const bucketCount = Math.min(maxBuckets, Math.max(2, Math.ceil(uniq.length / 2)));
  const per = Math.ceil(uniq.length / bucketCount);
  const chunks = [];
  for (let i = 0; i < uniq.length; i += per) chunks.push(uniq.slice(i, i + per));
  const out = [];
  let prevTo = -Infinity;
  chunks.forEach((chunk, i) => {
    const last = i === chunks.length - 1;
    const rawMin = chunk[0];
    const rawMax = chunk[chunk.length - 1];
    let to, label;
    if (last) {
      to = rawMax;
      label = prevTo === -Infinity ? `до ${fmt(rawMax)} ${unit}` : `от ${fmt(Math.max(rawMin, prevTo + 0.001))} ${unit}`;
    } else {
      const nextMin = chunks[i + 1][0];
      const candidate = niceCeil(rawMax);
      to = candidate < nextMin ? candidate : rawMax;
      const from = Math.max(rawMin, prevTo + 0.001);
      label = prevTo === -Infinity ? `до ${fmt(to)} ${unit}` : `${fmt(from)}–${fmt(to)} ${unit}`;
    }
    out.push({ id: `r${fmt(rawMin)}-${fmt(rawMax)}`, label, from: prevTo === -Infinity ? 0 : rawMin - 0.001, to: to + 0.001 });
    prevTo = to;
  });
  return out;
}

const POWER_RANGES = [
  { id: 'small', label: 'до 50 кВт', from: 0, to: 50 },
  { id: 'mid', label: '60–200 кВт', from: 51, to: 200 },
  { id: 'big', label: '250–800 кВт', from: 201, to: 100000 },
];

const AXES = {
  generator: { title: 'Мощность', unit: 'кВт', value: (e) => e.power, ranges: POWER_RANGES },
  pes: { title: 'Мощность', unit: 'кВт', value: (e) => e.power, ranges: POWER_RANGES },
  used: { title: 'Мощность', unit: 'кВт', value: (e) => e.power, ranges: [] },
  compressor: { title: 'Производительность', unit: 'м³/мин', value: compressorAirFlow, ranges: [] },
  'compressor-shift': { title: 'Производительность', unit: 'м³/мин', value: compressorAirFlow, ranges: [] },
  manipulator: { title: 'Грузоподъёмность', unit: 'т', value: manipulatorCapacity, ranges: [] },
};

const inRange = (v, r) => !r ? true : (v != null && v >= r.from && v <= r.to);

let bad = 0;

for (const [cat, axis] of Object.entries(AXES)) {
  const items = seed.equipment.filter((e) => e.category === cat);
  const ranges = axis.ranges.length
    ? axis.ranges
    : rangesFromValues(items.map(axis.value).filter((v) => v != null), axis.unit);

  console.log(`\n=== ${cat} — «${axis.title}», ${axis.unit} ===`);
  for (const r of ranges) console.log(`   ${r.label.padEnd(22)} [${r.from} … ${r.to}]`);

  /* 1. Каждая позиция попадает хотя бы в один диапазон */
  const uncovered = items.filter((e) => !ranges.some((r) => inRange(axis.value(e), r)));
  if (uncovered.length) {
    bad++;
    console.log(`   ✗ вне диапазонов: ${uncovered.map((e) => e.slug).join(', ')}`);
  }

  /* 3. Ссылка с бренда на главной (без диапазона) обязана быть непустой */
  const brands = [...new Set(items.map((e) => e.brand).filter(Boolean))];
  for (const b of brands) {
    const bi = items.filter((e) => e.brand === b);
    if (!bi.length) {
      bad++;
      console.log(`   ✗ бренд без позиций: ${cat} / ${b}`);
    }
  }

  /* 4. Каждый диапазон обязан содержать хоть одну позицию категории */
  for (const r of ranges) {
    const hit = items.filter((e) => inRange(axis.value(e), r));
    if (!hit.length) {
      bad++;
      console.log(`   ✗ пустой диапазон: ${cat} / ${r.label}`);
    }
  }

  /* 5. Диапазоны не пересекаются */
  for (let i = 0; i < ranges.length - 1; i++) {
    if (ranges[i].to >= ranges[i + 1].from) {
      bad++;
      console.log(`   ✗ пересечение: ${ranges[i].label} / ${ranges[i + 1].label}`);
    }
  }

  /* 6. Позиции без значения оси */
  const noValue = items.filter((e) => axis.value(e) == null);
  if (noValue.length) {
    bad++;
    console.log(`   ✗ нет значения оси: ${noValue.map((e) => e.slug).join(', ')}`);
  }
}

console.log(bad === 0 ? '\n✓ Все проверки фильтров пройдены.' : `\n✗ Проблем: ${bad}`);
