/**
 * Подготовка фирменных логотипов.
 *
 *   node scripts/prepare-brand.mjs
 *
 * Исходники — два варианта, присланные владельцем:
 *   • i.webp      — знак (шестерня с «Д» в перспективе);
 *   • i (1).webp  — полный логотип (шестерня + надпись «ДИЭН СИСТЕМС»).
 *
 * Обработка:
 *   1) определяем цвет фона по углу изображения и убираем его,
 *      сохраняя мягкий переход на границе;
 *   2) обрезаем пустые поля по содержимому;
 *   3) сохраняем в public/images/brand/ в PNG, WebP и AVIF,
 *      плюс favicon.ico, apple-icon.png и icon.png из знака.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = 'D:\\Загрузки';
const OUT = path.join(ROOT, 'public', 'images', 'brand');

fs.mkdirSync(OUT, { recursive: true });

/**
 * Убирает фон и обрезает пустые поля.
 * Возвращает { buffer, width, height } — PNG с прозрачностью.
 */
async function clean(input) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;

  /* Фоновый цвет — пиксель в левом верхнем углу */
  const bg = [data[0], data[1], data[2]];
  const dist = (i) =>
    Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]);

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const d = dist(i);
      /* Мягкий переход: 0 — чистый фон, 40 — содержимое */
      const alpha = Math.max(0, Math.min(255, Math.round((d - 12) * 7.5)));
      data[i + 3] = alpha;

      if (alpha > 12) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) {
    console.log('  ! изображение пустое после удаления фона');
    return null;
  }

  const pad = 4;
  const left = Math.max(0, minX - pad);
  const top = Math.max(0, minY - pad);
  const right = Math.min(width - 1, maxX + pad);
  const bottom = Math.min(height - 1, maxY + pad);

  const buffer = await sharp(data, { raw: { width, height, channels } })
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .png()
    .toBuffer();

  const m = await sharp(buffer).metadata();
  return { buffer, width: m.width, height: m.height };
}

async function prepare(file, name, maxWidth) {
  const src = path.join(SRC, file);
  if (!fs.existsSync(src)) {
    console.log(`  ! не найден: ${src}`);
    return null;
  }

  const raw = await sharp(src).metadata();
  console.log(`\n${file}: ${raw.width}×${raw.height} ${raw.format}`);

  const cleaned = await clean(src);
  if (!cleaned) return null;
  console.log(`  после обрезки: ${cleaned.width}×${cleaned.height}`);

  /* Ширина: не растягиваем выше исходника ×1.5, но не мельче 512 для ретины */
  const target = Math.min(maxWidth, Math.max(cleaned.width, 256));

  const base = sharp(cleaned.buffer);
  await base.clone().resize({ width: target }).png({ compressionLevel: 9, palette: true }).toFile(path.join(OUT, `${name}.png`));
  await base.clone().resize({ width: target }).webp({ quality: 92 }).toFile(path.join(OUT, `${name}.webp`));
  await base.clone().resize({ width: target }).avif({ quality: 70, effort: 5 }).toFile(path.join(OUT, `${name}.avif`));

  const sizes = ['png', 'webp', 'avif'].map((e) => {
    const st = fs.statSync(path.join(OUT, `${name}.${e}`));
    return `${e} ${Math.round(st.size / 1024)} КБ`;
  });
  console.log(`  сохранено (${target}px): ${sizes.join(' · ')}`);
  return { width: cleaned.width, height: cleaned.height, target };
}

console.log('=== подготовка логотипов ===');
const mark = await prepare('i.webp', 'mark', 512);
const logo = await prepare('i (1).webp', 'logo', 512);

console.log('\n=== иконки из знака ===');
if (mark) {
  const markPath = path.join(OUT, 'mark.png');

  const pngs = [];
  for (const size of [16, 32, 48]) {
    const data = await sharp(markPath).resize(size, size).png().toBuffer();
    pngs.push({ size, data });
  }
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const entries = [];
  let offset = 6 + pngs.length * 16;
  for (const { size, data } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size, 0);
    e.writeUInt8(size, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    offset += data.length;
  }
  fs.writeFileSync(
    path.join(ROOT, 'public', 'favicon.ico'),
    Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)])
  );
  console.log('  ✓ public/favicon.ico');

  await sharp(markPath).resize(180, 180).png({ compressionLevel: 9, palette: true }).toFile(path.join(ROOT, 'public', 'apple-icon.png'));
  console.log('  ✓ public/apple-icon.png');

  await sharp(markPath).resize(512, 512).png({ compressionLevel: 9, palette: true }).toFile(path.join(ROOT, 'public', 'icon.png'));
  console.log('  ✓ public/icon.png');
}
