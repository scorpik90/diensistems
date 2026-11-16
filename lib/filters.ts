import type { CategoryId, Equipment } from './types';

/**
 * Фильтры каталога — свои для каждой категории.
 *
 * Универсальный фильтр «по кВт» для всех категорий бессмысленен:
 * у компрессора важна производительность в м³/мин, у крана-манипулятора —
 * грузоподъёмность в тоннах. Поэтому ось фильтра выбирается по категории.
 *
 * Диапазоны для «электростанций» заданы явно: парк стабильный,
 * границы «до 50 / 60–200 / 250–800 кВт» привычны клиенту.
 * Для остальных категорий диапазоны строятся по фактическим значениям
 * позиций — так фильтр всегда соответствует тому, что есть в каталоге,
 * и ни одна комбинация «категория + бренд + диапазон» не даёт пустоты.
 */

/** Число из строки характеристики: «18 м³/мин» → 18 */
function parseValue(raw: string): number | null {
  const m = raw.replace(/\s/g, '').match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return null;
  const n = Number(m[0].replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Значение характеристики по шаблону названия строки */
export function specValue(e: Equipment, labels: RegExp): number | null {
  for (const g of e.specGroups ?? []) {
    for (const row of g.rows ?? []) {
      if (labels.test(row.label)) {
        const n = parseValue(row.value);
        if (n != null) return n;
      }
    }
  }
  return null;
}

/** Производительность компрессора, м³/мин */
export function compressorAirFlow(e: Equipment): number | null {
  return (
    specValue(e, /производительн/i) ??
    /* У части позиций производительность указана в тексте описания */
    (e.description ? parseValue(e.description.match(/([\d.,]+)\s*м3\/мин/i)?.[1] ?? '') : null)
  );
}

/** Грузоподъёмность манипулятора, т */
export function manipulatorCapacity(e: Equipment): number | null {
  return specValue(e, /грузоподъемност|грузоподъёмност/i) ?? e.power ?? null;
}

export interface FilterRange {
  id: string;
  label: string;
  /** Минимальное значение диапазона (включительно) */
  from: number;
  /** Максимальное значение диапазона (включительно) */
  to: number;
}

export interface FilterAxis {
  /** Заголовок группы фильтра */
  title: string;
  /** Единица измерения */
  unit: string;
  /** Как получить числовое значение оси у позиции */
  value: (e: Equipment) => number | null;
  /** Диапазоны */
  ranges: FilterRange[];
  /** Диапазон «все» — всегда первый */
  allLabel: string;
}

/* ─── Диапазоны для электростанций (парк стабильный, границы привычны) ── */

const POWER_RANGES: FilterRange[] = [
  { id: 'small', label: 'до 50 кВт', from: 0, to: 50 },
  { id: 'mid', label: '60–200 кВт', from: 51, to: 200 },
  { id: 'big', label: '250–800 кВт', from: 201, to: 100000 },
];

/** «Круглое» число для границы диапазона: 5, 10, 12, 20, 25, 50 … */
function niceCeil(v: number): number {
  if (v <= 0) return v;
  const steps = [1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
  for (const s of steps) {
    const n = Math.ceil(v / s) * s;
    if (n - v < s * 0.6) return Number(n.toFixed(2));
  }
  return Math.ceil(v);
}

/**
 * Диапазоны по фактическим значениям.
 *
 * Берём уникальные значения позиций, делим на равные по количеству
 * группы и подписываем их «круглыми» границами — так фильтр выглядит
 * опрятно и при этом ни одна комбинация «категория + бренд + диапазон»
 * не даёт пустоты: каждый диапазон покрывает реальные позиции.
 */
function rangesFromValues(
  values: number[],
  unit: string,
  maxBuckets = 4
): FilterRange[] {
  const uniq = [...new Set(values)].sort((a, b) => a - b);
  if (uniq.length === 0) return [];

  const fmt = (n: number) => String(n).replace('.', ',');

  /* Одна уникальная величина — один диапазон */
  if (uniq.length === 1) {
    return [{ id: 'all-bucket', label: `до ${fmt(uniq[0])} ${unit}`, from: 0, to: uniq[0] }];
  }

  /* Две-три величины — по диапазону на каждую */
  const bucketCount = Math.min(maxBuckets, Math.max(2, Math.ceil(uniq.length / 2)));
  const per = Math.ceil(uniq.length / bucketCount);

  const chunks: number[][] = [];
  for (let i = 0; i < uniq.length; i += per) chunks.push(uniq.slice(i, i + per));

  const out: FilterRange[] = [];
  let prevTo = -Infinity;

  chunks.forEach((chunk, i) => {
    const last = i === chunks.length - 1;
    const rawMin = chunk[0];
    const rawMax = chunk[chunk.length - 1];

    let to: number;
    let label: string;

    if (last) {
      to = rawMax;
      label = prevTo === -Infinity
        ? `до ${fmt(rawMax)} ${unit}`
        : `от ${fmt(Math.max(rawMin, prevTo + 0.001))} ${unit}`;
    } else {
      const nextMin = chunks[i + 1][0];
      /* Границу округляем вверх, но она не должна задевать следующий диапазон */
      const candidate = niceCeil(rawMax);
      to = candidate < nextMin ? candidate : rawMax;
      const from = Math.max(rawMin, prevTo + 0.001);
      label = prevTo === -Infinity
        ? `до ${fmt(to)} ${unit}`
        : `${fmt(from)}–${fmt(to)} ${unit}`;
    }

    out.push({ id: `r${fmt(rawMin)}-${fmt(rawMax)}`, label, from: prevTo === -Infinity ? 0 : rawMin - 0.001, to: to + 0.001 });
    prevTo = to;
  });

  return out;
}

/**
 * Ось фильтра для категории.
 */
export function axisFor(category: CategoryId | undefined): FilterAxis | null {
  switch (category) {
    case 'generator':
    case 'pes':
      return {
        title: 'Мощность',
        unit: 'кВт',
        value: (e) => e.power,
        ranges: POWER_RANGES,
        allLabel: 'Все',
      };

    case 'used':
      /* В продаже б/у позиций мало и мощности у них свои —
         диапазоны строим по фактическим значениям. */
      return {
        title: 'Мощность',
        unit: 'кВт',
        value: (e) => e.power,
        ranges: [],
        allLabel: 'Все',
      };

    case 'compressor':
    case 'compressor-shift':
      return {
        title: 'Производительность',
        unit: 'м³/мин',
        value: compressorAirFlow,
        ranges: [], // заполняется по данным
        allLabel: 'Все',
      };

    case 'manipulator':
      return {
        title: 'Грузоподъёмность',
        unit: 'т',
        value: manipulatorCapacity,
        ranges: [], // заполняется по данным
        allLabel: 'Все',
      };

    default:
      return null;
  }
}

/**
 * Ось фильтра с диапазонами, посчитанными по переданным позициям.
 */
export function buildAxis(
  category: CategoryId | undefined,
  items: Equipment[]
): FilterAxis | null {
  const axis = axisFor(category);
  if (!axis) return null;
  if (axis.ranges.length) return axis;

  const values = items
    .map((e) => axis.value(e))
    .filter((v): v is number => v != null && Number.isFinite(v));

  if (!values.length) return null;

  return { ...axis, ranges: rangesFromValues(values, axis.unit) };
}

/**
 * Попадает ли позиция в диапазон.
 */
export function inRange(value: number | null, range: FilterRange | null): boolean {
  if (!range) return true;
  if (value == null) return false;
  return value >= range.from && value <= range.to;
}

/**
 * Основная величина позиции для бейджа на карточке.
 * Возвращает пару «значение + единица» либо null.
 */
export function headlineMetric(
  e: Equipment
): { value: string; unit: string } | null {
  switch (e.category) {
    case 'compressor':
    case 'compressor-shift': {
      const v = compressorAirFlow(e);
      return v != null ? { value: String(v).replace('.', ','), unit: 'м³/мин' } : null;
    }
    case 'manipulator': {
      const v = manipulatorCapacity(e);
      return v != null ? { value: String(v).replace('.', ','), unit: 'т' } : null;
    }
    default:
      return e.power != null
        ? { value: String(e.power).replace('.', ','), unit: e.powerUnit || 'кВт' }
        : null;
  }
}

/**
 * Три ключевые характеристики для карточки.
 *
 * Порядок строк задан категорией: показываем то, что клиент ищет в первую
 * очередь. Если по нужному параметру данных нет — берём следующий
 * из реальных ТТХ позиции, а не подставляем заглушку.
 */
const SPEC_PRIORITY: Record<string, RegExp[]> = {
  generator: [
    /напряжен/i,
    /активная мощность/i,
    /нагрузка \d+%|расход топлива|ёмкость бака/i,
  ],
  pes: [
    /мощность/i,
    /напряжен/i,
    /нагрузка \d+%|расход топлива|ёмкость бака/i,
  ],
  compressor: [/производительн/i, /рабочее давление/i, /привод|тип двигателя/i],
  'compressor-shift': [/производительн/i, /рабочее давление/i, /привод|тип двигателя/i],
  manipulator: [
    /грузоподъемност|грузоподъёмност/i,
    /вылет стрелы/i,
    /длина стрелы|грузовой момент/i,
  ],
  used: [/активная мощность|мощность/i, /напряжен/i, /частота/i],
};

export function pickSpecs(
  e: Equipment,
  count = 3
): { label: string; value: string }[] {
  const priority = SPEC_PRIORITY[e.category] ?? [/мощность/i, /напряжен/i];

  /* Все строки ТТХ позиции, без повторов по названию */
  const rows: { label: string; value: string }[] = [];
  for (const g of e.specGroups ?? []) {
    for (const row of g.rows ?? []) {
      if (rows.some((r) => r.label === row.label)) continue;
      rows.push({ label: row.label, value: row.value });
    }
  }

  const out: { label: string; value: string }[] = [];
  const used = new Set<string>();

  for (const re of priority) {
    if (out.length >= count) break;
    const found = rows.find((r) => re.test(r.label) && !used.has(r.label));
    if (found) {
      out.push(found);
      used.add(found.label);
    }
  }

  /* Добираем любыми другими реальными характеристиками */
  for (const r of rows) {
    if (out.length >= count) break;
    if (used.has(r.label)) continue;
    out.push(r);
    used.add(r.label);
  }

  return out;
}
