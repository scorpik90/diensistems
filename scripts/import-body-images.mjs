/**
 * Перенос фотографий, вшитых в тексты статей и страниц, в медиатеку CMS.
 *
 *   node scripts/import-body-images.mjs
 *
 * В legacy-HTML остались три картинки внутри текста:
 *   <img src="http://diensystems.ru/images/legacy/0/400">
 *   <img src="http://diensystems.ru/images/legacy/1/400">
 *   <img src="/www.genorg.ru/images/legacy/2/400">
 *
 * Домен diensystems.ru больше не отвечает, а папки /images/legacy
 * на новом сайте нет — картинки битые. Скрипт:
 *   1) скачивает оригиналы с боевого сайта;
 *   2) заливает их в медиатеку Strapi;
 *   3) переписывает src в текстах статей и страниц на адрес CMS;
 *   4) обновляет эти записи в CMS и в content/seed.json.
 *
 * После этого ни одного файла вне CMS на сайте не остаётся.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const STRAPI_URL = (process.env.STRAPI_URL ?? 'http://127.0.0.1:1337').replace(/\/$/, '');
const TOKEN = process.env.STRAPI_TOKEN;
const ORIGIN = 'https://genorg.ru';
const UA = 'Mozilla/5.0 (compatible; genorg-migration/2.0)';

if (!TOKEN) {
  console.error('Нужен STRAPI_TOKEN.');
  process.exit(1);
}

const H = { Authorization: `Bearer ${TOKEN}` };

/**
 * Соответствие «номер legacy-папки → оригинал на боевом сайте».
 *
 * Номера проставлены скриптом migrate-legacy-images.mjs при переносе
 * legacy-HTML; оригиналы восстановлены по боевой версии статей.
 */
const LEGACY_SOURCES = {
  0: '/site/images/upload/Poleznoe/bezshsingen.jpg',
  1: '/site/images/upload/Poleznoe/izolvala.jpg',
  2: '/site/images/catalog/124/wall.png',
};

async function api(p, method = 'GET', body) {
  const res = await fetch(`${STRAPI_URL}${p}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...H },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`${method} ${p} → HTTP ${res.status}: ${t.slice(0, 200)}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

/** Загрузка файла в медиатеку (с переиспользованием по имени) */
async function upload(filePath, alternativeText, uniqueName) {
  const buf = await fsp.readFile(filePath);
  const form = new FormData();
  const ext = path.extname(filePath) || '.jpg';
  const name = `${uniqueName}${ext}`;
  form.append('files', new Blob([buf], { type: 'image/jpeg' }), name);
  form.append('fileInfo', JSON.stringify({ name, alternativeText: alternativeText ?? null }));

  const res = await fetch(`${STRAPI_URL}/api/upload`, {
    method: 'POST',
    headers: H,
    body: form,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`upload ${name} → HTTP ${res.status}: ${t.slice(0, 200)}`);
  }
  const json = await res.json();
  const first = Array.isArray(json) ? json[0] : json;
  return first.id;
}

async function findUploaded(name) {
  const res = await api(
    `/api/upload/files?filters[name][$eq]=${encodeURIComponent(name)}&pagination[pageSize]=1`
  );
  const first = Array.isArray(res) ? res[0] : res?.[0];
  return first?.id ?? null;
}

const seedPath = path.join(ROOT, 'content', 'seed.json');
const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

/* ── 1. Скачиваем оригиналы ── */
console.log('── Скачивание оригиналов ──');
const archiveDir = path.join(ROOT, 'assets', 'legacy-images', 'legacy');
const localFiles = new Map();

for (const [n, src] of Object.entries(LEGACY_SOURCES)) {
  const dir = path.join(archiveDir, n);
  const file = path.join(dir, '400.jpg');
  if (!fs.existsSync(file)) {
    const res = await fetch(ORIGIN + src, { headers: { 'User-Agent': UA } });
    if (!res.ok) {
      console.log(`  ✗ ${src} → HTTP ${res.status}`);
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    await fsp.mkdir(dir, { recursive: true });
    await fsp.writeFile(file, buf);
    console.log(`  ✓ ${src} → ${buf.length} байт`);
  }
  localFiles.set(Number(n), file);
}

/* ── 2. Заливаем в медиатеку ── */
console.log('\n── Загрузка в медиатеку ──');
const mediaUrls = new Map();
for (const [n, file] of localFiles) {
  const name = `body-${n}`;
  const ext = path.extname(file) || '.jpg';
  let id = await findUploaded(`${name}${ext}`);
  if (!id) id = await upload(file, `Изображение из текста (legacy ${n})`, name);
  const files = await api(`/api/upload/files/${id}`);
  const url = files?.url ?? files?.data?.url ?? null;
  if (!url) {
    console.log(`  ! не удалось получить адрес файла ${name}`);
    continue;
  }
  /* В текст кладём относительный путь: сайт сам подставит публичный
     адрес CMS при рендере (CMS_PUBLIC_URL). Так текст не зависит
     от окружения — dev, стейдж или прод. */
  mediaUrls.set(n, url);
  console.log(`  ✓ ${name} → ${url}`);
}

/* ── 3. Переписываем тексты ── */
console.log('\n── Переписывание текстов ──');

/**
 * Восстановление порядка картинок внутри одной записи.
 *
 * Нужно для материала, где в тексте несколько картинок: они идут
 * подряд, и каждой соответствует свой номер legacy-папки.
 */
const LEGACY_ORDER = {
  'besshetochnyjsinhronnyjgenerator': [0, 1],
  dopoborudovanie: [2],
};

/**
 * Ищет в HTML ссылки на legacy-картинки и заменяет их на путь в CMS.
 */
function rewriteHtml(html, alt, order = []) {
  if (!html) return { html, count: 0, changed: false };
  let count = 0;
  let out = html.replace(
    /<img([^>]*?)src="[^"]*\/images\/legacy\/(\d+)\/400([^"]*)"([^>]*)>/g,
    (whole, before, n, after, tail) => {
      const url = mediaUrls.get(Number(n));
      if (!url) return whole;
      count++;
      /* alt добавляем, только если его ещё нет — иначе получится
         два атрибута, и браузер возьмёт первый (пустой). */
      const hasAlt = /(^|\s)alt=/.test(before + tail);
      const altAttr = hasAlt ? '' : alt ? ` alt="${alt}"` : ' alt=""';
      return `<img${before}src="${url}"${after}${tail}${altAttr}>`;
    }
  );
  /* Нормализуем ранее записанные абсолютные адреса CMS → относительные */
  out = out.replace(/(src|href)="https?:\/\/[^"]*\/uploads\//g, '$1="/uploads/');
  /* Восстанавливаем ссылки на файлы, которых больше нет: если файл
     в медиатеке перезалили, у него новое имя — стапим актуальное. */
  out = out.replace(/\/uploads\/body_(\d+)_[a-z0-9]+\.(?:jpg|jpeg|png|webp|avif)/gi, (whole, n) => {
    const url = mediaUrls.get(Number(n));
    return url ?? whole;
  });
  /* Убираем возможные дубли alt (появились при прошлых переносах)
     и ставим один — с названием материала.
     ВНИМАНИЕ: «<img» вне группы и должно вернуться в замену,
     иначе тег пропадёт. */
  out = out.replace(
    /<img([^>]*?)src="(\/uploads\/body_\d+_[a-z0-9]+\.(?:jpg|jpeg|png|webp|avif))"([^>]*?)>/gi,
    (whole, before, src, after) => {
      const cleaned = `<img${before}src="${src}"${after}`
        .replace(/\s+alt="[^"]*"/gi, '')
        .trimEnd();
      return `${cleaned} alt="${alt}">`;
    }
  );
  /* Ремонт: если тег <img> потерялся (бывает после неудачной
     перезаписи) — собираем его заново по порядку картинок.
     ВНИМАНИЕ: регулярка здесь намеренно строгая — [^<>] не даёт
     «съесть» кусок текста между соседними тегами. */
  if (/src="\/uploads\/body"/.test(out)) {
    let k = 0;
    out = out.replace(
      /(<[^<>]*?)src="\/uploads\/body" alt="([^"]*)">/g,
      (whole, before, a) => {
        const n = order[k++];
        const url = n !== undefined ? mediaUrls.get(n) : null;
        if (!url) return whole;
        return `${before}src="${url}" alt="${a}">`;
      }
    );
  }
  return { html: out, count, changed: out !== html };
}

/** Текст без разметки — для alt */
const plain = (html) =>
  String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);

let total = 0;
const touched = { articles: [], pages: [] };

for (const a of seed.articles ?? []) {
  const { html, count, changed } = rewriteHtml(a.bodyHtml, plain(a.title), LEGACY_ORDER[a.slug] ?? []);
  if (changed) {
    a.bodyHtml = html;
    total += count;
    touched.articles.push(a);
  }
}
for (const p of seed.pages ?? []) {
  const { html, count, changed } = rewriteHtml(p.bodyHtml, plain(p.title), LEGACY_ORDER[p.slug] ?? []);
  if (changed) {
    p.bodyHtml = html;
    total += count;
    touched.pages.push(p);
  }
}

console.log(`  заменено ссылок: ${total}`);
console.log(`  затронуто статей: ${touched.articles.length}, страниц: ${touched.pages.length}`);

if (!touched.articles.length && !touched.pages.length) {
  console.log('\nМенять нечего — все картинки уже в CMS.');
  process.exit(0);
}

/* ── 4. Сохраняем в seed и обновляем записи CMS ── */
await fsp.writeFile(seedPath, JSON.stringify(seed, null, 2), 'utf8');
console.log('\n  обновлён content/seed.json');

for (const a of touched.articles) {
  const res = await api(
    `/api/articles?filters[slug][$eq]=${encodeURIComponent(a.slug)}&pagination[pageSize]=1`
  );
  const rec = res?.data?.[0];
  if (!rec) {
    console.log(`  ! статья «${a.slug}» не найдена в CMS`);
    continue;
  }
  await api(`/api/articles/${rec.documentId ?? rec.id}`, 'PUT', {
    data: { bodyHtml: a.bodyHtml },
  });
  console.log(`  ✓ статья «${a.slug}»`);
}

for (const p of touched.pages) {
  const res = await api(
    `/api/pages?filters[slug][$eq]=${encodeURIComponent(p.slug)}&pagination[pageSize]=1`
  );
  const rec = res?.data?.[0];
  if (!rec) {
    console.log(`  ! страница «${p.slug}» не найдена в CMS`);
    continue;
  }
  await api(`/api/pages/${rec.documentId ?? rec.id}`, 'PUT', {
    data: { bodyHtml: p.bodyHtml },
  });
  console.log(`  ✓ страница «${p.slug}»`);
}

console.log('\nГотово. Пересоберите сайт, чтобы обновились статические страницы.');
