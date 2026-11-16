import fs from 'node:fs';

/**
 * Перенос legacy-фото из описаний и полей image.
 *
 *   node scripts/migrate-legacy-images.mjs
 *
 * В описаниях б/у техники и в поле image остались пути вида
 * /site/images/foto/111/с300.jpg — на новом сайте их нет.
 * Скрипт скачивает эти файлы, кладёт в public/images/legacy/<n>/
 * и переписывает пути в content/seed.json (в тексте и в поле image).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public', 'images', 'legacy');
const ORIGIN = 'https://genorg.ru';
const UA = 'Mozilla/5.0 (compatible; genorg-migration/2.0)';

const seedPath = path.join(ROOT, 'content', 'seed.json');
const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

const legacyPaths = new Set();
const collect = (html) => {
  if (!html) return;
  for (const m of String(html).matchAll(/\/site\/images\/[^"')\s]+\.(?:jpe?g|png|gif|webp)/gi)) {
    legacyPaths.add(m[0]);
  }
};

/* Поля image тоже могут содержать legacy-путь */
for (const e of seed.equipment ?? []) if (e.image) collect(e.image);
for (const c of seed.cases ?? []) if (c.image) collect(c.image);

for (const e of seed.equipment ?? []) {
  collect(e.description);
  collect(JSON.stringify(e.specGroups ?? []));
}
for (const c of seed.cases ?? []) collect(c.bodyHtml);
for (const a of seed.articles ?? []) collect(a.bodyHtml);
for (const p of seed.pages ?? []) collect(p.bodyHtml);

console.log('legacy-путей найдено:', legacyPaths.size);

let n = 0;
const map = new Map();

for (const legacy of legacyPaths) {
  let buf;
  try {
    const res = await fetch(ORIGIN + legacy, { headers: { 'User-Agent': UA } });
    if (!res.ok) {
      console.log(`  ✗ ${legacy} → HTTP ${res.status}`);
      continue;
    }
    buf = Buffer.from(await res.arrayBuffer());
  } catch (e) {
    console.log(`  ✗ ${legacy} → ${e.message}`);
    continue;
  }

  const dir = path.join(PUBLIC, String(n));
  fs.mkdirSync(dir, { recursive: true });

  const meta = await sharp(buf).metadata();
  const w = Math.min(meta.width ?? 800, 800);

  const variants = [
    ['avif', (i) => i.avif({ quality: 50, effort: 4 })],
    ['webp', (i) => i.webp({ quality: 72 })],
    ['jpg', (i) => i.jpeg({ quality: 72, mozjpeg: true })],
  ];
  for (const [ext, fn] of variants) {
    const out = await fn(sharp(buf).resize({ width: w, withoutEnlargement: true })).toBuffer();
    fs.writeFileSync(path.join(dir, `400.${ext}`), out);
  }

  const local = `/images/legacy/${n}/400`;
  map.set(legacy, local);
  console.log(
    `  ✓ ${legacy} → ${local}.jpg  (${meta.width}×${meta.height}, ${Math.round(buf.length / 1024)} КБ → ${Math.round(fs.statSync(path.join(dir, '400.jpg')).size / 1024)} КБ)`
  );
  n++;
}

/* Переписываем пути в тексте */
let replaced = 0;
const rewrite = (obj) => {
  if (typeof obj === 'string') {
    let out = obj;
    for (const [from, to] of map) {
      if (out.includes(from)) {
        out = out.split(from).join(to);
        replaced++;
      }
    }
    return out;
  }
  if (Array.isArray(obj)) return obj.map(rewrite);
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = rewrite(v);
    return out;
  }
  return obj;
};

const updated = rewrite(seed);

/* Поле image: legacy-путь → папка (без /400) */
for (const e of updated.equipment ?? []) {
  if (e.image && map.has(e.image)) {
    e.image = map.get(e.image).replace('/400', '');
    replaced++;
  }
}
for (const c of updated.cases ?? []) {
  if (c.image && map.has(c.image)) {
    c.image = map.get(c.image).replace('/400', '');
    replaced++;
  }
}

fs.writeFileSync(seedPath, JSON.stringify(updated, null, 2), 'utf8');
console.log(`\nзаменено ссылок: ${replaced}`);
console.log('обновлён content/seed.json — дальше node scripts/import-to-strapi.mjs --reset');
