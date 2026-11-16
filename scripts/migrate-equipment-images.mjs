/**
 * Восстанавливает карту «позиция → legacy-файл» и перекачивает фото
 * в полноразмерном качестве.
 *
 *   node scripts/migrate-equipment-images.mjs
 *
 * На старом сайте у каждой позиции есть два файла:
 *   «16/c700d5_small.png» — маленький (267 px, для превью);
 *   «16/c700d5.png»       — полноразмерный (800 px).
 *
 * Раньше скрипт тянул только _small — фото на сайте были мыльные.
 * Теперь источник выбирается по качеству: сначала полноразмерный
 * оригинал, при 404 — _small.
 *
 * В CMS у каждой позиции уже готовый путь «eq/<n>», поэтому скрипт
 * НЕ трогает content/seed.json — он перезаписывает только файлы
 * внутри public/images/eq/<n>/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'images', 'eq');
const ORIGIN = 'https://genorg.ru';
const UA = 'Mozilla/5.0 (compatible; genorg-migration/2.0)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchRetry(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (r.ok) return r;
      if (r.status === 404) return null;
    } catch {
      /* ретрай */
    }
    await sleep(1200);
  }
  return null;
}

const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'seed.json'), 'utf8'));

/* ─── 1. Собираем карту slug → legacy-файл со страниц боевого сайта ─── */

console.log('=== Собираем карту изображений с боевого сайта ===');

const legacyMap = {};
const extraImages = {};

for (const e of seed.equipment ?? []) {
  if (!e.image?.match(/^eq\/\d+$/)) continue;

  const r = await fetchRetry(`${ORIGIN}/${e.slug}`);
  if (!r) {
    console.log(`  ! ${e.slug}: страница недоступна`);
    continue;
  }
  const html = await r.text();

  /* Все фото со страницы — вдруг у позиции есть галерея */
  const all = [
    ...new Set(
      [...html.matchAll(/(?:src|data-src)=["']([^"']+\.(?:png|jpe?g))["']/gi)]
        .map((m) => m[1])
        .filter((p) => p.includes('/site/images/catalog/'))
        .map((p) => p.replace('/site/images/catalog/', ''))
    ),
  ];

  if (!all.length) {
    console.log(`  · ${e.slug}: фото на странице нет`);
    continue;
  }

  /* Первое фото — основное (как в миграции), остальные — в галерею */
  legacyMap[e.slug] = all[0];
  if (all.length > 1) extraImages[e.slug] = all.slice(1);

  console.log(`  ✓ ${e.slug.padEnd(46)} ${all[0]}${all.length > 1 ? ` (+${all.length - 1} в галерее)` : ''}`);
  await sleep(500);
}

fs.writeFileSync(
  path.join(ROOT, 'content', 'legacy-images.json'),
  JSON.stringify(legacyMap, null, 2),
  'utf8'
);
console.log(`\nкарта сохранена: content/legacy-images.json (${Object.keys(legacyMap).length} позиций)`);

if (Object.keys(extraImages).length) {
  console.log('галереи:');
  for (const [slug, list] of Object.entries(extraImages)) {
    console.log(`  ${slug}: ${list.join(', ')}`);
  }
}

/* ─── 2. Перекачиваем фото в полноразмерном качестве ─── */

console.log('\n=== Обработка изображений ===');

let ok = 0;
let failed = 0;
let upgraded = 0;

for (const e of seed.equipment ?? []) {
  const dir = e.image?.match(/^eq\/(\d+)$/);
  if (!dir) continue;

  const legacy = legacyMap[e.slug];
  if (!legacy) {
    failed++;
    continue;
  }

  const base = legacy.replace(/(_small)?\.(png|jpe?g)$/i, '');
  const candidates = [
    `${base}.png`,
    `${base}.jpg`,
    `${base}_small.png`,
    `${base}_small.jpg`,
  ];

  let buf = null;
  let usedSrc = '';
  let srcW = 0;
  let srcH = 0;

  for (const cand of candidates) {
    const r = await fetchRetry(`${ORIGIN}/site/images/catalog/${cand}`);
    if (!r) continue;
    const b = Buffer.from(await r.arrayBuffer());
    if (b.length < 1000) continue;
    const meta = await sharp(b).metadata();
    buf = b;
    usedSrc = cand;
    srcW = meta.width ?? 0;
    srcH = meta.height ?? 0;
    if (!/_small\./.test(cand)) break;
  }
  await sleep(400);

  if (!buf) {
    console.log(`  ✗ ${e.slug}: источник недоступен (${legacy})`);
    failed++;
    continue;
  }

  const target = path.join(OUT, dir[1]);
  fs.mkdirSync(target, { recursive: true });

  const width = Math.min(srcW, 800);

  const variants = [
    ['avif', (i) => i.avif({ quality: 52, effort: 5 })],
    ['webp', (i) => i.webp({ quality: 78 })],
    ['jpg', (i) => i.jpeg({ quality: 82, mozjpeg: true })],
  ];

  /* sharp повторно обработает буфер — готовим один раз */
  let written = false;
  for (let attempt = 1; attempt <= 3 && !written; attempt++) {
    try {
      for (const [ext, fn] of variants) {
        const out = await fn(
          sharp(buf)
            /* Прозрачный фон — в белый: JPEG альфу не умеет,
               без этого техника «чернеет» */
            .flatten({ background: '#ffffff' })
            .resize({ width, withoutEnlargement: true, kernel: 'lanczos3' })
            .sharpen({ sigma: 0.5 })
            .modulate({ saturation: 1.03 })
        ).toBuffer();
        fs.writeFileSync(path.join(target, `400.${ext}`), out);
      }
      written = true;
    } catch (err) {
      console.log(`    · попытка ${attempt} не удалась: ${err.message}`);
      await sleep(800);
    }
  }

  if (!written) {
    console.log(`  ✗ ${e.slug}: не удалось обработать (${usedSrc})`);
    failed++;
    continue;
  }

  const size = Math.round(fs.statSync(path.join(target, '400.jpg')).size / 1024);
  const isFull = !/_small\./.test(usedSrc);
  if (isFull) upgraded++;
  console.log(
    `  ✓ ${e.slug.padEnd(46)} ${usedSrc.padEnd(26)} ${srcW}×${srcH} → ${width} px (${size} КБ)`
  );
  ok++;
}

console.log(`\nобработано: ${ok}, из них полноразмерных: ${upgraded}, без источника: ${failed}`);
