/**
 * Перенос контента и медиа в Strapi.
 *
 *   node scripts/import-content-to-cms.mjs
 *
 * Делает четыре вещи:
 *   1) заливает фотографии из assets/legacy-images в медиатеку Strapi
 *      и проставляет их в позициях каталога, кейсах и настройках;
 *   2) создаёт коллекцию «Текстовый блок» (редактируемые тексты сайта);
 *   3) создаёт коллекцию «Пункт меню» (шапка, мега-меню, подвал);
 *   4) переносит тексты категорий: краткий ответ, факты, FAQ, состав аренды.
 *
 * Идемпотентно: повторный прогон обновляет существующие записи,
 * лишние не создаёт. Медиатека при повторе переиспользуется по имени файла.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const STRAPI_URL = (process.env.STRAPI_URL ?? 'http://127.0.0.1:1337').replace(/\/$/, '');
const TOKEN = process.env.STRAPI_TOKEN;

if (!TOKEN) {
  console.error('Нужен STRAPI_TOKEN.');
  process.exit(1);
}

const H = { Authorization: `Bearer ${TOKEN}` };

async function api(p, method = 'GET', body) {
  const res = await fetch(`${STRAPI_URL}${p}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...H },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`${method} ${p} → HTTP ${res.status}: ${t.slice(0, 300)}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

/** Загрузка одного файла в медиатеку. Возвращает id загруженного файла. */
async function upload(filePath, alternativeText, uniqueName) {
  const buf = await fsp.readFile(filePath);
  const form = new FormData();
  const ext = path.extname(filePath) || '.jpg';
  const name = `${uniqueName}${ext}`;
  form.append('files', new Blob([buf], { type: 'image/jpeg' }), name);
  form.append(
    'fileInfo',
    JSON.stringify({ name, alternativeText: alternativeText ?? null })
  );

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

/** Найти уже загруженный файл по имени — чтобы не грузить дважды */
async function findUploaded(name) {
  const res = await api(
    `/api/upload/files?filters[name][$eq]=${encodeURIComponent(name)}&pagination[pageSize]=1`
  );
  const first = Array.isArray(res) ? res[0] : res?.[0];
  return first?.id ?? null;
}
async function upsert(collection, attrs, matchKey, matchValue) {
  const res = await api(
    `/api/${collection}?filters[${matchKey}][$eq]=${encodeURIComponent(matchValue)}&pagination[pageSize]=1`
  );
  const existing = res?.data?.[0] ?? null;
  if (existing) {
    const docId = existing.documentId ?? existing.id;
    await api(`/api/${collection}/${docId}`, 'PUT', { data: attrs });
    return 'updated';
  }
  await api(`/api/${collection}`, 'POST', { data: attrs });
  return 'created';
}

/** Полная очистка коллекции */
async function reset(collection) {
  const res = await api(`/api/${collection}?pagination[pageSize]=500`);
  const items = Array.isArray(res?.data) ? res.data : [];
  for (const item of items) {
    await api(`/api/${collection}/${item.documentId ?? item.id}`, 'DELETE');
  }
  return items.length;
}

/* ────────────────────────────────────────────────────────────────────── */

const seed = JSON.parse(await fsp.readFile(path.join(ROOT, 'content', 'seed.json'), 'utf8'));
const content = JSON.parse(
  await fsp.readFile(path.join(ROOT, 'content', 'cms-content.json'), 'utf8')
);

console.log(`CMS: ${STRAPI_URL}\n`);

/* ── 0. Очистка медиатеки ──────────────────────────────────────────── */

if (process.argv.includes('--clean-media')) {
  console.log('── Очистка медиатеки ──');
  let removed = 0;
  for (let page = 0; page < 20; page++) {
    const res = await api('/api/upload/files?pagination[pageSize]=100&pagination[page]=' + page);
    const files = Array.isArray(res) ? res : [];
    if (!files.length) break;
    for (const f of files) {
      await api(`/api/upload/files/${f.id}`, 'DELETE');
      removed++;
    }
    if (files.length < 100) break;
  }
  console.log(`  удалено файлов: ${removed}\n`);
}

/* ── 1. Медиа ───────────────────────────────────────────────────────── */

console.log('── Загрузка медиа ──');

/**
 * Кэш загрузок: ключ — уникальное имя файла в медиатеке.
 *
 * Имя должно быть уникальным: исходники всех позиций называются
 * одинаково («400.jpg»), поэтому в медиатеку они попадают под своими
 * именами («eq-21.jpg», «case-37.jpg»).
 */
const mediaCache = new Map();

async function uploadOnce(filePath, alt, uniqueName) {
  if (mediaCache.has(uniqueName)) return mediaCache.get(uniqueName);
  /* В медиатеке файл лежит под именем с расширением («eq-21.jpg»),
     поэтому ищем именно так — иначе каждый прогон создаёт дубль. */
  const ext = path.extname(filePath) || '.jpg';
  const existing = await findUploaded(`${uniqueName}${ext}`);
  const id = existing ?? (await upload(filePath, alt, uniqueName));
  mediaCache.set(uniqueName, id);
  return id;
}

/* Позиции каталога: image = «eq/N» → assets/legacy-images/eq/N/400.jpg */
const eqMedia = new Map();
let uploaded = 0;
for (const e of seed.equipment) {
  if (!e.image) continue;
  const dir = e.image.split('/')[0] + '/' + e.image.split('/')[1];
  const file = path.join(ROOT, 'assets', 'legacy-images', dir, '400.jpg');
  if (!fs.existsSync(file)) {
    console.log(`  ! нет файла для «${e.image}» — ${e.slug}`);
    continue;
  }
  const unique = `eq-${e.image.split('/')[1]}`;
  eqMedia.set(e.slug, await uploadOnce(file, e.imageAlt || e.title, unique));
  uploaded++;
}
console.log(`  позиций каталога: ${eqMedia.size}`);

/* Кейсы: image = «N/имя.jpg» → assets/legacy-images/case/N/267.jpg */
const caseMedia = new Map();
for (const c of seed.cases) {
  if (!c.image) continue;
  const id = c.image.split('/')[0];
  const file = path.join(ROOT, 'assets', 'legacy-images', 'case', id, '267.jpg');
  if (!fs.existsSync(file)) {
    console.log(`  ! нет файла для «${c.image}» — ${c.slug}`);
    continue;
  }
  caseMedia.set(c.slug, await uploadOnce(file, c.title, `case-${id}`));
}
console.log(`  кейсов: ${caseMedia.size}`);

/* Логотипы и фон */
const brandFiles = [
  ['logo', path.join(ROOT, 'assets', 'legacy-images', 'brand', 'logo.png'), 'ДИЭН-Системс — логотип', 'logo'],
  ['logoMark', path.join(ROOT, 'assets', 'legacy-images', 'brand', 'mark.png'), 'ДИЭН-Системс — знак', 'logo-mark'],
  ['heroImage', path.join(ROOT, 'assets', 'legacy-images', 'hero-2', '1280.jpg'), 'Дизельные генераторы на объекте', 'hero'],
];
const brandMedia = {};
for (const [key, file, alt, unique] of brandFiles) {
  if (!fs.existsSync(file)) {
    console.log(`  ! нет файла ${file}`);
    continue;
  }
  brandMedia[key] = await uploadOnce(file, alt, unique);
}
console.log(`  логотипы и фон: ${Object.keys(brandMedia).length}`);

/* ── 2. Текстовые блоки ─────────────────────────────────────────────── */

console.log('\n── Текстовые блоки ──');
const removed = await reset('content-blocks');
let blocks = 0;
for (const b of content.blocks) {
  await upsert(
    'content-blocks',
    {
      key: b.key,
      group: b.group,
      title: b.title ?? null,
      text: b.text ?? null,
      value: b.value ?? null,
      items: b.items ?? null,
      order: b.order ?? 0,
      isActive: b.isActive ?? true,
    },
    'key',
    b.key
  );
  blocks++;
}
console.log(`  удалено старых: ${removed}, записано: ${blocks}`);

/* ── 3. Пункты меню ─────────────────────────────────────────────────── */

console.log('\n── Пункты меню ──');
const removedMenu = await reset('menu-items');
let menus = 0;
for (const m of content.menu) {
  await upsert(
    'menu-items',
    {
      group: m.group,
      label: m.label,
      href: m.href,
      note: m.note || null,
      order: m.order ?? 0,
      isActive: m.isActive ?? true,
    },
    'id',
    `${m.group}:${m.href}`
  );
  menus++;
}
console.log(`  удалено старых: ${removedMenu}, записано: ${menus}`);

/* ── 4. Категории: тексты страницы ──────────────────────────────────── */

console.log('\n── Тексты категорий ──');
for (const cat of content.categories ? Object.entries(content.categories) : []) {
  const [key, c] = cat;
  await upsert(
    'categories',
    {
      answer: c.answer ?? null,
      facts: c.facts ?? null,
      includes: c.includes ?? null,
      includesNote: c.includesNote ?? null,
      faq: c.faq ?? null,
    },
    'key',
    key
  );
  console.log(`  ${key}: ответ, факты, состав, FAQ`);
}

/* ── 5. Привязка медиа к записям ────────────────────────────────────── */

console.log('\n── Привязка фото к записям ──');
let eqDone = 0;
for (const [slug, id] of eqMedia) {
  await api(`/api/equipment?filters[slug][$eq]=${encodeURIComponent(slug)}&pagination[pageSize]=1`)
    .then(async (res) => {
      const rec = res?.data?.[0];
      if (!rec) return;
      await api(`/api/equipment/${rec.documentId ?? rec.id}`, 'PUT', { data: { image: [id] } });
      eqDone++;
    });
}
console.log(`  позиций с фото: ${eqDone}`);

let caseDone = 0;
for (const [slug, id] of caseMedia) {
  await api(`/api/cases?filters[slug][$eq]=${encodeURIComponent(slug)}&pagination[pageSize]=1`)
    .then(async (res) => {
      const rec = res?.data?.[0];
      if (!rec) return;
      await api(`/api/cases/${rec.documentId ?? rec.id}`, 'PUT', { data: { image: [id] } });
      caseDone++;
    });
}
console.log(`  кейсов с фото: ${caseDone}`);

/* ── 6. Настройки сайта: медиа и тексты ─────────────────────────────── */

console.log('\n── Настройки сайта ──');
const settingsRes = await api('/api/site-settings?pagination[pageSize]=1');
const settingsRec = settingsRes?.data?.[0];
if (settingsRec) {
  const patch = {
    yandexOrgId: settingsRec.yandexOrgId ?? '1088163471',
    footerAbout: settingsRec.footerAbout ?? content.blocks.find((b) => b.key === 'footer.main')?.items?.about ?? null,
    footerBottom: settingsRec.footerBottom ?? content.blocks.find((b) => b.key === 'footer.main')?.items?.bottom ?? null,
    footerContactsTitle:
      settingsRec.footerContactsTitle ??
      content.blocks.find((b) => b.key === 'footer.main')?.items?.contactsTitle ??
      'Контакты',
    legalPolicyUrl:
      settingsRec.legalPolicyUrl ?? '/politika-obrabotki-personalnyh-dannyh',
    seoTitle: settingsRec.seoTitle ?? null,
    seoDescription: settingsRec.seoDescription ?? null,
    ogTitle: settingsRec.ogTitle ?? null,
    ogDescription: settingsRec.ogDescription ?? null,
  };
  if (brandMedia.logo) patch.logo = [brandMedia.logo];
  if (brandMedia.logoMark) patch.logoMark = [brandMedia.logoMark];
  if (brandMedia.heroImage) patch.heroImage = [brandMedia.heroImage];
  await api(`/api/site-settings/${settingsRec.documentId ?? settingsRec.id}`, 'PUT', { data: patch });
  console.log('  медиа и тексты подвала записаны');
} else {
  console.log('  ! нет записи site-settings — сначала выполните import-to-strapi.mjs');
}

console.log('\nГотово.');
