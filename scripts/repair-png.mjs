/**
 * Ремонт PNG с повреждённым zlib-потоком.
 *
 * У файла 95/hino700.png на боевом сайте битый IDAT: поток
 * распаковывается не полностью, и zlib падает с «incorrect data check».
 *
 * Что делаем:
 *   1) распаковываем поток вручную, без требования сходимости Adler-32;
 *   2) разворачиваем PNG-фильтры (Sub, Up, Average, Paeth);
 *   3) недостающие нижние строки добираем копией последней целой —
 *      это 2 строки из 600, на глаз незаметно.
 *
 * Модуль используется и как отдельный скрипт:
 *   node scripts/repair-png.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import sharp from 'sharp';

const ORIGIN = 'https://genorg.ru';
const UA = 'Mozilla/5.0 (compatible; genorg-migration/2.0)';

/** Распаковка zlib без требования сходимости Adler-32 */
function inflateTolerant(data) {
  return new Promise((resolve) => {
    const stream = zlib.createInflate({ finishFlush: zlib.constants.Z_SYNC_FLUSH });
    const chunks = [];
    let error = null;
    stream.on('data', (c) => chunks.push(c));
    stream.on('error', (e) => {
      error = e;
    });
    stream.on('end', () => resolve({ data: Buffer.concat(chunks), error }));
    stream.on('close', () => resolve({ data: Buffer.concat(chunks), error }));
    stream.end(data);
  });
}

/**
 * Разбор PNG и восстановление пикселей.
 * Возвращает null, если файл починить нельзя.
 */
export async function repairPng(buf) {
  let off = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idat = [];

  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.slice(off + 4, off + 8).toString('ascii');
    const data = buf.slice(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    }
    if (type === 'IDAT') idat.push(data);
    off += 12 + len;
    if (type === 'IEND') break;
  }

  if (bitDepth !== 8 || interlace !== 0 || !width || !height) return null;
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  if (!channels) return null;

  const { data: raw } = await inflateTolerant(Buffer.concat(idat));
  if (!raw?.length) return null;

  const stride = width * channels;
  const rowLen = 1 + stride;

  /* Сколько строк распаковалось целиком */
  const rows = Math.floor(raw.length / rowLen);
  if (rows < 2) return null;

  /* Разворачиваем PNG-фильтры */
  const bpp = channels;
  const out = Buffer.alloc(rows * stride);
  let pos = 0;
  for (let y = 0; y < rows; y++) {
    const filter = raw[pos++];
    const line = raw.slice(pos, pos + stride);
    pos += stride;
    const cur = out.slice(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.slice((y - 1) * stride, y * stride) : Buffer.alloc(stride);

    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      switch (filter) {
        case 1: v = (v + a) & 0xff; break;
        case 2: v = (v + b) & 0xff; break;
        case 3: v = (v + ((a + b) >> 1)) & 0xff; break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          v = (v + pr) & 0xff;
          break;
        }
        default: break;
      }
      cur[x] = v;
    }
  }

  /* Недостающие строки добираем копией последней целой */
  const full = Buffer.alloc(height * stride);
  out.copy(full, 0, 0, Math.min(rows * stride, full.length));
  if (rows < height) {
    const lastRow = full.slice((rows - 1) * stride, rows * stride);
    for (let y = rows; y < height; y++) lastRow.copy(full, y * stride);
  }

  return {
    data: full,
    width,
    height,
    channels,
    repairedRows: height - rows,
    totalRows: height,
  };
}

/* ─── Скрипт: чиним конкретный файл ─── */

const isMain = process.argv[1]?.endsWith('repair-png.mjs');

if (isMain) {
  /* Файл 95/hino700.png на боевом сайте повреждён (битый IDAT).
     Те же фотографии лежат в других папках каталога — берём оттуда. */
  const TARGETS = [
    { files: ['31/hino700.png', '93/hino700.png'], dir: 'public/images/eq/21' },
  ];

  for (const t of TARGETS) {
    let saved = false;

    for (const file of t.files) {
      const r = await fetch(`${ORIGIN}/site/images/catalog/${file}`, {
        headers: { 'User-Agent': UA },
      });
      if (!r.ok) continue;
      const buf = Buffer.from(await r.arrayBuffer());

      try {
        const meta = await sharp(buf).metadata();
        const img = sharp(buf);
        fs.mkdirSync(t.dir, { recursive: true });
        for (const [ext, fn] of [
          ['jpg', (i) => i.jpeg({ quality: 84, mozjpeg: true })],
          ['webp', (i) => i.webp({ quality: 80 })],
          ['avif', (i) => i.avif({ quality: 52, effort: 5 })],
        ]) {
          const out = await fn(
            img.clone()
              .resize({ width: 800, withoutEnlargement: true, kernel: 'lanczos3' })
              .sharpen({ sigma: 0.5 })
              .modulate({ saturation: 1.03 })
          ).toBuffer();
          fs.writeFileSync(path.join(t.dir, `400.${ext}`), out);
        }
        console.log(`  ✓ ${file}: ${meta.width}×${meta.height} → сохранено`);
        saved = true;
        break;
      } catch {
        console.log(`  · ${file}: повреждён, пробуем следующий`);
      }
    }

    if (!saved) {
      /* Крайний случай — маленькая версия */
      const r = await fetch(`${ORIGIN}/site/images/catalog/95/hino700_small.png`, {
        headers: { 'User-Agent': UA },
      });
      const buf = Buffer.from(await r.arrayBuffer());
      const meta = await sharp(buf).metadata();
      fs.mkdirSync(t.dir, { recursive: true });
      const img = sharp(buf);
      for (const [ext, fn] of [
        ['jpg', (i) => i.jpeg({ quality: 84, mozjpeg: true })],
        ['webp', (i) => i.webp({ quality: 80 })],
        ['avif', (i) => i.avif({ quality: 52, effort: 5 })],
      ]) {
        const out = await fn(img.clone().resize({ width: 400, kernel: 'lanczos3' })).toBuffer();
        fs.writeFileSync(path.join(t.dir, `400.${ext}`), out);
      }
      console.log(`  → откат на _small: ${meta.width}×${meta.height}`);
    }
  }
}
