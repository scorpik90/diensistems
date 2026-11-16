/**
 * Оптимизация фото объектов (кейсов) по данным CMS.
 *
 *   node scripts/migrate-case-images.mjs
 *
 * Фото объектов лежат на старом сайте в двух видах: уменьшенном
 * («…_small.jpg», 267×200) и полноразмерном (800×600). Раньше на новый
 * сайт попадала только уменьшенная версия — картинки в блоке «Объекты»
 * выглядели мыльно, особенно на ретина-экранах.
 *
 * Скрипт:
 *   1) берёт legacy-путь из поля image («37/dscn0438_small.jpg»);
 *   2) сначала скачивает ПОЛНОРАЗМЕРНЫЙ вариант (без суффикса _small),
 *      а если его нет (404/ошибка) — откатывается на _small;
 *   3) режет кадр по ширине 400 px (lanczos3) — для кейсов увеличение
 *      разрешено, чтобы картинка не мылила на retina;
 *   4) слегка подтягивает резкость и контраст (только для тёмных
 *      и выцветших снимков) и кодирует JPEG / WebP / AVIF
 *      в assets/legacy-images/case/<id>/267.*.
 *
 * Имена файлов (267.jpg / 267.webp / 267.avif) и поле image в
 * content/seed.json не меняются — ссылки в коде остаются рабочими.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'legacy-images', 'case');
const ORIGIN = 'https://genorg.ru';
const UA = 'Mozilla/5.0 (compatible; genorg-migration/2.0)';

/**
 * Ширина, под которую режем фото объекта.
 *
 * На сайте кадр показывается в 267 px, но файл лежит в 400 px —
 * на retina это честные 400 устройственных пикселей вместо растянутых
 * 267. Имя файла при этом остаётся прежним (267.jpg), ссылки не ломаются.
 */
const WIDTH = 400;
/** Имя файлов в папке: /images/case/<id>/267.jpg */
const NAME = '267';

/** Резкость после уменьшения — лёгкая, чтобы не появились «ореолы» */
const SHARPEN = { sigma: 0.8, m1: 1, m2: 1.2, x1: 2, y2: 6, y3: 12 };

const seedPath = path.join(ROOT, 'content', 'seed.json');
const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

/* ─── источники ─────────────────────────────────────────────────────── */

/** Полный URL по legacy-пути («37/dscn0438_small.jpg») */
const toUrl = (src) => `${ORIGIN}/site/images/catalog/${encodeURI(src)}`;

/**
 * Кандидаты-источники: сначала полный размер, потом _small.
 * Если в имени нет суффикса _small — кандидат один.
 */
function sourceCandidates(src) {
  const full = src.replace(/_small(\.[a-z0-9]+)$/i, '$1');
  return full !== src ? [full, src] : [src];
}

/** Скачать первый доступный кандидат; null — если не скачался ни один */
async function download(candidates) {
  for (const src of candidates) {
    const url = toUrl(src);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) {
        console.log(`    · ${src} → HTTP ${res.status}, пробуем дальше`);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      /* проверяем, что это реальное изображение, а не html-заглушка */
      const meta = await sharp(buf).metadata();
      if (!meta.width || !meta.height) throw new Error('не изображение');
      return { src, url, buf, meta };
    } catch (err) {
      console.log(`    · ${src} → ${err.message}, пробуем дальше`);
    }
  }
  return null;
}

/* ─── обработка ─────────────────────────────────────────────────────── */

/**
 * Лёгкая «человеческая» обработка: контраст — только если он реально
 * плоский, яркость и насыщенность — только для тёмных/выцветших снимков.
 * Фото должно остаться естественным, поэтому пороги осторожные.
 */
async function enhance(pipeline) {
  const stats = await pipeline.clone().stats();
  const ch = stats.channels.slice(0, 3);
  const mean = ch.reduce((a, c) => a + c.mean, 0) / ch.length;
  const stdev = ch.reduce((a, c) => a + c.stdev, 0) / ch.length;
  const colorfulness = Math.max(...ch.map((c) => c.mean)) - Math.min(...ch.map((c) => c.mean));

  let contrast = 1;
  let brightness = 1;
  let saturation = 1;
  const notes = [];

  if (stdev < 48) {
    const k = Math.min(0.1, ((48 - stdev) / 48) * 0.12);
    contrast = 1 + k;
    notes.push(`контраст +${Math.round(k * 100)}%`);
  }
  if (mean < 85) {
    brightness = 1.06;
    notes.push('яркость +6%');
  }
  if (colorfulness < 6) {
    saturation = 1.06;
    notes.push('насыщенность +6%');
  }

  let out = pipeline;
  if (contrast !== 1) out = out.linear(contrast, 128 * (1 - contrast));
  if (brightness !== 1 || saturation !== 1) out = out.modulate({ brightness, saturation });
  out = out.sharpen(SHARPEN);

  return { pipeline: out, notes, mean, stdev };
}

/** Кадр → три формата в папке dir */
async function writeVariants(dir, buf, width) {
  const base = sharp(buf, { failOn: 'none' }).rotate().toColourspace('srgb');
  const meta = await base.metadata();
  if (meta.hasAlpha) base.flatten({ background: '#ffffff' });

  /* для кейсов увеличение разрешено: 267×200 → 400×300 с lanczos3 */
  const resized = base.resize({ width, kernel: 'lanczos3', withoutEnlargement: false });
  const { pipeline, notes } = await enhance(resized);

  const variants = [
    ['jpg', (i) => i.jpeg({ quality: 82, mozjpeg: true })],
    ['webp', (i) => i.webp({ quality: 80 })],
    ['avif', (i) => i.avif({ quality: 55, effort: 5 })],
  ];
  const sizes = {};
  for (const [ext, fn] of variants) {
    const out = await fn(pipeline.clone()).toBuffer();
    fs.writeFileSync(path.join(dir, `${NAME}.${ext}`), out);
    sizes[ext] = out.length;
  }

  const after = await sharp(fs.readFileSync(path.join(dir, `${NAME}.jpg`))).metadata();
  return { sizes, after, notes };
}

/* ─── основной проход ───────────────────────────────────────────────── */

let ok = 0;
let failed = 0;
let skipped = 0;
const rows = [];

for (const c of seed.cases ?? []) {
  const id = (c.image ?? '').split('/')[0].trim();
  if (!/^\d+$/.test(id)) {
    console.log(`  · ${c.slug}: нет legacy-пути к фото — пропускаем`);
    skipped++;
    continue;
  }

  const dir = path.join(OUT, id);

  /* было — до перезаписи */
  const before = fs.existsSync(path.join(dir, `${NAME}.jpg`))
    ? await sharp(fs.readFileSync(path.join(dir, `${NAME}.jpg`))).metadata()
    : null;

  const got = await download(sourceCandidates(c.image));
  if (!got) {
    console.log(`  ✗ ${c.slug}: ${c.image} недоступен — оставляем как есть`);
    failed++;
    continue;
  }

  fs.mkdirSync(dir, { recursive: true });
  const { sizes, after, notes } = await writeVariants(dir, got.buf, WIDTH);

  console.log(
    `  ✓ ${c.slug.padEnd(30)} ${got.src.padEnd(24)} → case/${id}  ` +
      `${got.meta.width}×${got.meta.height} → ${after.width}×${after.height}  ` +
      `${Math.round(got.buf.length / 1024)} КБ → ${Math.round(sizes.jpg / 1024)} КБ` +
      (notes.length ? `  [${notes.join(', ')}]` : '')
  );

  rows.push({
    path: `case/${id}`,
    src: got.src,
    srcSize: got.buf.length,
    was: before ? `${before.width}×${before.height}` : '—',
    now: `${after.width}×${after.height}`,
    outSize: sizes.jpg,
    notes: notes.join(', ') || 'без правок',
  });

  ok++;
}

/* ─── отчёт ─────────────────────────────────────────────────────────── */

console.log('\nпапка    источник                  исходник       было      стало     результат');
console.log('─'.repeat(88));
for (const r of rows) {
  console.log(
    `${r.path.padEnd(8)} ${r.src.padEnd(25)} ${String(Math.round(r.srcSize / 1024)).padStart(5)} КБ   ` +
      `${r.was.padEnd(9)} ${r.now.padEnd(9)} ${String(Math.round(r.outSize / 1024)).padStart(4)} КБ  ${r.notes}`
  );
}

console.log(`\nобработано: ${ok}, пропущено: ${skipped}, без источника: ${failed}`);
