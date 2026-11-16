/**
 * Проверка полноты CMS.
 *
 *   node scripts/_check-cms-coverage.mjs
 *
 * Сравнивает содержимое Strapi с эталоном content/cms-content.json
 * и с данными каталога. Цель — убедиться, что сайт действительно
 * берёт тексты и медиа из CMS, а не пользуется запасными значениями
 * из кода.
 *
 * Проверяется:
 *   1) все текстовые блоки есть в CMS и в них заполнены те же поля;
 *   2) все пункты меню есть в CMS;
 *   3) у каждой категории заполнены ответ, факты, состав аренды и FAQ;
 *   4) у каждой позиции каталога и каждого кейса есть фото в медиатеке;
 *   5) в настройках сайта есть логотип, знак и фон.
 */
import fs from 'node:fs';

const STRAPI_URL = (process.env.STRAPI_URL ?? 'http://127.0.0.1:1337').replace(/\/$/, '');
const tokens = JSON.parse(fs.readFileSync('.strapi-tokens.json', 'utf8'));
const H = { Authorization: `Bearer ${tokens['genorg-read']}` };
const BASE = `${STRAPI_URL}/api`;

const content = JSON.parse(fs.readFileSync('content/cms-content.json', 'utf8'));
const seed = JSON.parse(fs.readFileSync('content/seed.json', 'utf8'));

async function api(path) {
  const res = await fetch(`${BASE}${path}`, { headers: H });
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return res.json();
}

const problems = [];
const note = (msg) => problems.push(msg);

console.log('════════ Покрытие CMS ════════\n');

/* ── 1. Текстовые блоки ── */
const blocksRes = await api('/content-blocks?pagination[pageSize]=200');
const cmsBlocks = new Map((blocksRes.data ?? []).map((b) => [b.key, b]));

let fieldsMissing = 0;
for (const b of content.blocks) {
  const rec = cmsBlocks.get(b.key);
  if (!rec) {
    note(`блок «${b.key}» отсутствует в CMS`);
    continue;
  }
  const cmsItems = rec.items ?? {};
  for (const field of Object.keys(b.items ?? {})) {
    const v = cmsItems[field];
    if (v === undefined || v === null || v === '') {
      note(`блок «${b.key}»: поле «${field}» пустое`);
      fieldsMissing++;
    }
  }
}
console.log(`  текстовых блоков: ${content.blocks.length} в эталоне, ${cmsBlocks.size} в CMS`);
console.log(`  незаполненных полей: ${fieldsMissing}`);

/* ── 2. Пункты меню ── */
const menuRes = await api('/menu-items?pagination[pageSize]=200');
const cmsMenu = menuRes.data ?? [];
const cmsMenuKeys = new Set(cmsMenu.map((m) => `${m.group}:${m.href}`));
for (const m of content.menu) {
  if (!cmsMenuKeys.has(`${m.group}:${m.href}`)) {
    note(`пункт меню «${m.label}» (${m.group}) отсутствует в CMS`);
  }
}
console.log(`  пунктов меню: ${content.menu.length} в эталоне, ${cmsMenu.length} в CMS`);

/* ── 3. Категории ── */
const catsRes = await api('/categories?pagination[pageSize]=100&populate=*');
const cmsCats = new Map((catsRes.data ?? []).map((c) => [c.key, c]));
for (const [key, c] of Object.entries(content.categories)) {
  const rec = cmsCats.get(key);
  if (!rec) {
    note(`категория «${key}» отсутствует в CMS`);
    continue;
  }
  if (!rec.answer) note(`категория «${key}»: пустой краткий ответ`);
  if (!Array.isArray(rec.facts) || !rec.facts.length) {
    note(`категория «${key}»: пустой блок фактов`);
  }
  if (!Array.isArray(rec.includes) || !rec.includes.length) {
    note(`категория «${key}»: пустой список «что входит в стоимость»`);
  }
  /* Проверяем форму данных: список — это строки или объекты с текстом,
     иначе на странице будут пустые пункты списка. */
  for (const item of rec.includes ?? []) {
    const text = typeof item === 'string' ? item : item?.text;
    if (!text) note(`категория «${key}»: пункт списка без текста (${JSON.stringify(item)})`);
  }
  if (!Array.isArray(rec.faq) || !rec.faq.length) {
    note(`категория «${key}»: пустой FAQ`);
  }
  for (const f of rec.faq ?? []) {
    if (!f?.q || !f?.a) note(`категория «${key}»: FAQ без вопроса или ответа`);
  }
  for (const f of rec.facts ?? []) {
    if (!f?.label || !f?.value) note(`категория «${key}»: факт без подписи или значения`);
  }
}
console.log(`  категорий с контентом: ${Object.keys(content.categories).length}`);

/* ── 4. Медиа в позициях и кейсах ── */
const eqRes = await api('/equipment?pagination[pageSize]=200&populate=*');
const withImage = (eqRes.data ?? []).filter((e) => e.image);
const needImage = seed.equipment.filter((e) => e.image);
console.log(`  позиций с фото: ${withImage.length} из ${needImage.length} (в каталоге ${seed.equipment.length})`);
for (const e of needImage) {
  const rec = (eqRes.data ?? []).find((x) => x.slug === e.slug);
  if (!rec?.image) note(`позиция «${e.slug}»: нет фото в медиатеке`);
}

const casesRes = await api('/cases?pagination[pageSize]=100&populate=*');
const casesWithImage = (casesRes.data ?? []).filter((c) => c.image);
console.log(`  кейсов с фото: ${casesWithImage.length} из ${seed.cases.length}`);
for (const c of seed.cases) {
  const rec = (casesRes.data ?? []).find((x) => x.slug === c.slug);
  if (!rec?.image) note(`кейс «${c.slug}»: нет фото в медиатеке`);
}

/* ── 5. Настройки сайта ── */
const setRes = await api('/site-settings?pagination[pageSize]=1&populate=*');
const settings = (setRes.data ?? [])[0] ?? {};
for (const f of ['logo', 'logoMark', 'heroImage']) {
  if (!settings[f]) note(`в настройках сайта нет «${f}»`);
}
console.log(`  медиа в настройках: логотип=${!!settings.logo}, знак=${!!settings.logoMark}, фон=${!!settings.heroImage}`);

/* ── Итог ── */
console.log('');
if (problems.length) {
  console.log(`✗ замечаний: ${problems.length}`);
  for (const p of problems.slice(0, 40)) console.log(`   · ${p}`);
  if (problems.length > 40) console.log(`   … ещё ${problems.length - 40}`);
  process.exit(1);
}
console.log('✓ CMS заполнена полностью: все тексты, меню и фотографии берутся из CMS.');
