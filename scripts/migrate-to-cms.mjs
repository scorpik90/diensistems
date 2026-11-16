/**
 * Миграция v2: полный обход боевого genorg.ru → единая модель данных.
 *
 *   node scripts/migrate-to-cms.mjs
 *
 * Зачем v2: инвентарь показал 91 URL на 6 разных легаси-шаблонов
 * (ДГУ, ПЭС, компрессоры, манипуляторы, продажа б/у, статьи, кейсы,
 * статические страницы). Headless сводит их к 5 сущностям:
 *
 *   equipment  — вся техника (6 категорий, один шаблон)
 *   cases      — объекты
 *   articles   — статьи базы знаний
 *   pages      — статические страницы
 *   settings   — глобальные настройки
 *
 * Побочный эффект: дублирующиеся легаси-URL (например, один компрессор
 * живёт и на /arendacompressoraairmanpds185s, и на /kompressornasmeny330)
 * собираются в legacyUrls[] и превращаются в честные 301-редиректы.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CACHE = path.join(ROOT, '_cache');
const ORIGIN = 'https://genorg.ru';
const UA = 'Mozilla/5.0 (compatible; genorg-migration/2.0)';

/* Категории техники */
const CATEGORIES = {
  'arendadizelnogogeneratora': { id: 'generator', label: 'Дизельный генератор', unit: 'кВт' },
  'arendapes': { id: 'pes', label: 'Передвижная станция (ПЭС)', unit: 'кВт' },
  'arendacompressora': { id: 'compressor', label: 'Компрессор', unit: ' бар' },
  'kompressornasmeny': { id: 'compressor-shift', label: 'Компрессор (смена)', unit: ' бар' },
  'arendamanipulatora': { id: 'manipulator', label: 'Кран-манипулятор', unit: 'т' },
  'generatorkwtkupit': { id: 'used', label: 'Продажа б/у', unit: 'кВт' },
};

/* ─── утилиты ────────────────────────────────────────────────────────── */

async function fetchHtml(pathname) {
  const file = path.join(CACHE, pathname.replace(/[^\w.-]/g, '_') + '.html');
  try {
    return await fs.readFile(file, 'utf8');
  } catch {
    /* нет кэша */
  }
  const res = await fetch(ORIGIN + pathname, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${pathname} → HTTP ${res.status}`);
  const html = await res.text();
  await fs.mkdir(CACHE, { recursive: true });
  await fs.writeFile(file, html, 'utf8');
  return html;
}

const text = (s) => (s || '').replace(/\s+/g, ' ').replace(/&nbsp;/g, ' ').trim();

function num(v) {
  if (v == null) return null;
  /* Дефис здесь — разделитель («Арендовать - 2000 руб»), а не знак минус,
     поэтому убираем его вместе с прочими не-цифрами. */
  const s = String(v).replace(/[^\d,.]/g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Цена из текста. На боевом сайте цена живёт в разных местах:
 *   «Арендовать - 2000 руб/сутки»   (кнопка в карточке)
 *   «Цена 12 000 руб./смена»         (заголовок ПЭС/манипулятора)
 *   «за 1 500 000 руб с наработкой…» (продажа б/у)
 *   «48 000 р/сутки»
 *
 * ВАЖНО: здесь нельзя использовать \b — в JavaScript кириллица
 * не считается «word-символом», и \b после «руб» перед «/» не срабатывает.
 */
function parsePrice(raw) {
  if (!raw) return null;

  const m = String(raw).match(/([\d][\d\s ]*)\s*(?:руб(?:лей|ля|ль)?|р\.?)/i);
  if (!m) return null;

  const value = num(m[1]);
  if (value == null || value <= 0) return null;

  /* Единица: /сутки, /час, /смена — если она стоит рядом с ценой.
     Учитываем варианты «руб./смена», «руб / смена», «руб/сутки» и
     падежные формы («смену», «сутки», «день»). */
  const unitMatch = String(raw).match(
    /([\d][\d\s ]*)\s*(?:руб(?:лей|ля|ль)?|р\.?)\s*[.\/]*\s*(сутки|сут|час|смен[ау]|день|месяц)/i
  );
  let unit = '';
  if (unitMatch) {
    const word = unitMatch[2].toLowerCase().replace(/смен[ау]$/, 'смена');
    unit = '/' + word;
  }

  return { value, unit };
}

/**
 * Заголовок страницы. Легаси-вёрстка непоследовательна:
 *   - карточки ДГУ:  <h1 id="pagetitle">Название</h1>
 *   - ПЭС/компрессоры/манипуляторы: <h1>Полное название с ценой</h1>
 *                                    + <h2 id="pagetitle">Подзаголовок</h2>
 *   - статьи:       <h2 id="pagetitle">Заголовок</h2>  (вообще без <h1>!)
 *   - статические:  <h2 id="pagetitle">Заголовок</h2>
 */
function extractTitle($) {
  const h1 = text($('h1').first().text());
  const h2p = text($('h2#pagetitle').first().text());
  return {
    title: h1 || h2p,
    subtitle: h1 && h2p && h1 !== h2p ? h2p : '',
  };
}

/** Категория и тип по URL */
function classify(pathname) {
  const p = pathname.replace(/^\//, '');
  for (const [prefix, meta] of Object.entries(CATEGORIES)) {
    if (p.startsWith(prefix)) return { ...meta, prefix };
  }
  if (/^generator\d+kwtkupit$/.test(p)) return { ...CATEGORIES.generatorkwtkupit, prefix: 'generator' };
  if (/^arendagenerator(a|ov)\d|^arenda400kWtv|^obespechenie/i.test(p)) {
    return { id: 'case', label: 'Кейс', prefix: '' };
  }
  return null;
}

function sanitizeHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    /* Заголовки вынесены в отдельное поле страницы — убираем из тела,
       иначе на странице будет два <h1> (плохо для SEO и a11y). */
    .replace(/<h1[^>]*>[\s\S]*?<\/h1>/gi, '')
    .replace(/<h2 id="pagetitle"[^>]*>[\s\S]*?<\/h2>/gi, '')
    .replace(/<font[^>]*color\s*=\s*["']?#?d92525["']?[^>]*>/gi, '<span class="hl">')
    .replace(/<font[^>]*>/gi, '<span>')
    .replace(/<\/font>/gi, '</span>')
    .replace(/style\s*=\s*"[^"]*color\s*:\s*#d92525[^"]*"/gi, 'class="hl"')
    .replace(/style\s*=\s*"[^"]*"/gi, '')
    .replace(/<table[^>]*cellpadding\s*=\s*"\d+"[^>]*>/gi, '<table>')
    .replace(/<table[^>]*cellspacing\s*=\s*"\d+"[^>]*>/gi, '<table>')
    .replace(/<td[^>]*>/gi, '<td>')
    .trim();
}

/* ─── 1. Обход ──────────────────────────────────────────────────────── */

async function crawl() {
  const found = new Set(['/']);
  const queue = ['/'];
  const pages = new Map();

  while (queue.length) {
    const p = queue.shift();
    if (pages.has(p)) continue;

    let html;
    try {
      html = await fetchHtml(p);
    } catch {
      continue;
    }
    const $ = cheerio.load(html);
    const title = text($('title').first().text());
    /* Легаси-сайт отдаёт «страницу не найдено» с кодом 200 и
       полноценным .page-body на 5 КБ. Без этой проверки три статьи
       из /poleznoe попали бы в миграцию как «контент». */
    const isError =
      /информация не найдена/i.test(title) ||
      /<страница>\s*не\s*<найдена>/i.test(title) ||
      /не найден/i.test(title);
    pages.set(p, { path: p, html, $, title, isError });

    for (const m of html.matchAll(/href="([^"#?]+)"/g)) {
      const h = m[1];
      if (!h.startsWith('/') || h.startsWith('//')) continue;
      if (!/\/[a-zA-Z0-9]/.test(h)) continue;
      if (/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff2?|xml|txt)$/i.test(h)) continue;
      const clean = h.replace(/\/$/, '') || '/';
      if (!found.has(clean)) {
        found.add(clean);
        queue.push(clean);
      }
    }
  }
  return pages;
}

/* ─── 2. Разбор страницы ────────────────────────────────────────────── */

function parseEquipment(pathname, page) {
  const $ = page.$;
  const cat = classify(pathname);
  if (!cat || cat.id === 'case') return null;

  const { title: h1, subtitle } = extractTitle($);
  if (!h1) return null;

  /* Название модели и цена */
  let model = text($('.gen-desc-h').first().text()) || text($('.gen-body b').first().text());

  /* У компрессоров и манипуляторов заголовок обобщённый («Аренда дизельного
     компрессора») — берём модель из URL, она там есть: airmanpds185s,
     hino500, isuzugiga и т.д. */
  if (!model || /компрессор|манипулятор|электростанци/i.test(model)) {
    const fromSlug = prettyModelFromSlug(pathname);
    if (fromSlug) model = fromSlug;
  }
  if (!model) model = h1;

  const priceRaw =
    text($('.gen-price').first().text()) ||
    text($('.price-item').first().text()) ||
    (/(?:за\s)?[\d][\d\s]*\s*руб[\d\s\/\.]*/i.exec(h1)?.[0] ?? '') ||
    text($('p').filter((_, p) => /руб/i.test($(p).text())).first().text());

  /* ТТХ */
  const specGroups = [];
  $('.specs').each((_, wrap) => {
    $(wrap).find('.gen-specs').each((__, block) => {
      const group = text($(block).find('.specs-h h3').first().text());
      const rows = [];
      $(block).find('.specs-list li').each((__, li) => {
        const label = text($(li).find('.specs-l').text());
        const value = text($(li).find('.specs-r').text());
        if (label) rows.push({ label, value });
      });
      if (rows.length) specGroups.push({ group, rows });
    });
  });
  $('.gen-body > .specs-list li').each((__, li) => {
    const label = text($(li).find('.specs-l').text());
    const value = text($(li).find('.specs-r').text());
    if (label && !specGroups.some((g) => g.rows.some((r) => r.label === label))) {
      specGroups.push({ group: 'Прочие характеристики', rows: [{ label, value }] });
    }
  });

  /* Мощность / грузоподъёмность / производительность */
  const allRows = specGroups.flatMap((g) => g.rows);
  const powerFromTitle = num(h1.match(/(\d+)\s*(кВт|квт|т\b|тонн)/i)?.[1]);
  const powerFromSpec = num(
    allRows.find((r) => /мощност|грузоподъём|производительност/i.test(r.label))?.value
  );
  const power =
    powerFromTitle ??
    powerFromSpec ??
    num(model.match(/(\d+)/)?.[1] ??
      null);

  const image = $('img').first().attr('src');
  const imageAlt = text($('img').first().attr('alt'));

  const finalModel = model || subtitle || h1;

  return {
    slug: pathname.replace(/^\//, ''),
    category: cat.id,
    categoryLabel: cat.label,
    title: buildTitle(cat.id, subtitle || h1, finalModel),
    titleFull: h1,
    model: finalModel,
    brand: brandFromModel(finalModel),
    isNew: false,
    power: powerFromTitle ?? powerFromSpec ?? null,
    powerUnit: cat.unit.trim(),
    price: parsePrice(priceRaw),
    priceRaw,
    specGroups,
    image: image ? image.replace('/site/images/catalog/', '') : null,
    imageAlt,
    description: text($('.gen-body').text()).slice(0, 3000),
    legacyUrls: [pathname.replace(/^\//, '')],
  };
}

function parseArticle(pathname, page) {
  if (page.isError) return null;
  const $ = page.$;
  const { title: h1 } = extractTitle($);
  if (!h1) return null;
  const body = $('.page-body');
  const html = body.length ? sanitizeHtml(body.html()) : '';
  if (html.length < 300) return null;

  return {
    slug: pathname.replace(/^\//, ''),
    title: h1,
    bodyHtml: html,
    excerpt: text(html).slice(0, 220),
    legacyUrls: [pathname.replace(/^\//, '')],
  };
}

function parseCase(pathname, page) {
  const $ = page.$;
  const { title: h1 } = extractTitle($);
  if (!h1) return null;
  const body = $('.page-body');
  return {
    slug: pathname.replace(/^\//, ''),
    title: h1,
    kW: num(h1.match(/(\d+)\s*кВт/i)?.[1]),
    bodyHtml: body.length ? sanitizeHtml(body.html()) : '',
    image: $('img').first().attr('src')?.replace('/site/images/catalog/', '') ?? null,
    legacyUrls: [pathname.replace(/^\//, '')],
  };
}

function parseStaticPage(pathname, page) {
  const $ = page.$;
  const { title: h1 } = extractTitle($);
  if (!h1) return null;
  const body = $('.page-body');
  const html = body.length ? sanitizeHtml(body.html()) : '';
  if (!html) return null;

  const slug = pathname.replace(/^\//, '');
  return {
    slug,
    title: h1,
    bodyHtml: html,
    excerpt: text(html).slice(0, 220),
    legacyUrls: [slug],
  };
}

/**
 * Картинки кейсов лежат на индексе /nashiobekty (блоки .s-item),
 * а не на страницах отдельных объектов. Собираем соответствие
 * slug → путь к файлу и подставляем в кейсы.
 */
async function scrapeCaseImages() {
  const $ = cheerio.load(await fetchHtml('/nashiobekty'));
  const map = new Map();
  $('.s-item').each((_, el) => {
    const $el = $(el);
    const href = $el.find('a[href^="/"]').first().attr('href') || '';
    const src = $el.find('img').first().attr('src') || '';
    if (!href || !src) return;
    map.set(href.replace(/^\//, '').replace(/\/$/, ''), src.replace('/site/images/catalog/', ''));
  });
  return map;
}


/**
 * Название модели из URL.
 * У компрессоров заголовок легаси-страницы обобщённый («Аренда дизельного
 * компрессора»), поэтому различающий модель код есть только в адресе:
 *   arendacompressoraairmanpds185s → Airman PDS185S
 *   arendacompressoraatlascopcoxahs400pace → Atlas Copco XAHS400PACE
 *   kompressornasmenymolotki → Компрессор под молоток
 */
const BRAND_RULES = [
  { prefix: 'atlascopco', label: 'Atlas Copco' },
  { prefix: 'airman', label: 'Airman' },
  { prefix: 'denyo', label: 'Denyo' },
  { prefix: 'cummins', label: 'Cummins' },
  { prefix: 'hino', label: 'HINO' },
  { prefix: 'isuzu', label: 'ISUZU' },
];

function prettyModelFromSlug(slug) {
  const lower = slug.toLowerCase().replace(/^\//, '');

  if (lower.startsWith('kompressornasmeny')) {
    const kind = lower.replace('kompressornasmeny', '');
    if (kind === 'molotki') return 'Компрессор под молоток';
    if (kind === 'betonolom') return 'Компрессор под бетонолом';
    return `Компрессор ${kind.toUpperCase()}`;
  }

  const stripped = lower
    .replace(/^arendacompressora/, '')
    .replace(/^arendamanipulatora/, '')
    .replace(/^arendapes/, '')
    .replace(/^arendadizelnogogeneratora/, '');

  for (const r of BRAND_RULES) {
    if (stripped.startsWith(r.prefix)) {
      return `${r.label} ${stripped.slice(r.prefix.length).toUpperCase()}`.trim();
    }
  }
  return stripped.toUpperCase();
}

/** Заголовок карточки, если легаси-заголовок обобщённый */
function buildTitle(category, legacyTitle, model) {
  const generic = !/\d/.test(legacyTitle);
  if (!generic) return legacyTitle;
  if (category === 'compressor') return `Аренда компрессора ${model}`;
  if (category === 'compressor-shift') {
    return `Аренда компрессора ${model.replace(/^Компрессор\s*/i, '')} (по сменам)`;
  }
  return legacyTitle;
}


/** Бренд по названию модели: Airman SDG150 → Airman, HINO 300 → HINO. */
function brandFromModel(model) {
  const m = (model ?? '').toLowerCase();
  /* Название может начинаться с типа техники:
     «Дизель-генератор Airman SDG150» → ищем бренд в любой позиции. */
  if (/airman/.test(m)) return 'Airman';
  if (/denyo/.test(m)) return 'Denyo';
  if (/cummins/.test(m)) return 'Cummins';
  if (/hino/.test(m)) return 'HINO';
  if (/isuzu/.test(m)) return 'ISUZU';
  if (/atlas copco/.test(m)) return 'Atlas Copco';
  if (/palfinger/.test(m)) return 'PALFINGER';
  if (/\bunic\b/.test(m)) return 'UNIC';
  if (/fassi/.test(m)) return 'FASSI';
  return null;
}

/* Каталоги и статические страницы — известные легаси-URL */
const CATALOG_PAGES = {
  '/arendageneratorov': 'generator',
  '/mobilnyegeneratory': 'pes',
  '/arendakompressorov': 'compressor',
  '/kompressornasmeny': 'compressor-shift',
  '/arendamanipulatora': 'manipulator',
  '/prodazhabu': 'used',
};

const STATIC_PAGES = [
  ['/contacts', 'static'],
  ['/dostavka', 'static'],
  ['/prodazhatopliva', 'static'],
  ['/dopoborudovanie', 'static'],
  ['/poleznoe', 'articles'],
  ['/nashiobekty', 'cases'],
];

/* ─── 3. Сборка модели ──────────────────────────────────────────────── */

(async () => {
  console.log('═══ Миграция v2: genorg.ru → headless CMS ═══\n');

  console.log('[1] Обход боевого сайта…');
  const pages = await crawl();
  const real = [...pages.values()].filter((p) => !p.isError);
  console.log(`    URL всего: ${pages.size}, рабочих: ${real.length}\n`);

  const equipment = [];
  const articles = [];
  const cases = [];
  const staticPages = [];
  let priceTables = [];

  console.log('[2] Разбор страниц…');
  const unparsed = [];

  for (const p of real) {
    const path = p.path;
    if (path === '/') continue;

    /* Каталог техники → статическая страница с фильтром по категории */
    if (CATALOG_PAGES[path]) {
      const $ = p.$;
      const { title } = extractTitle($);
      staticPages.push({
        slug: path.replace(/^\//, ''),
        title: title || 'Каталог',
        bodyHtml: '',
        excerpt: '',
        kind: 'catalog',
        category: CATALOG_PAGES[path],
        legacyUrls: [path.replace(/^\//, '')],
      });
      continue;
    }

    /* Прайс-лист — отдельная сущность (таблицы) */
    if (path === '/tsenyinaarendu') {
      const $ = p.$;
      priceTables = [];
      $('.page-tbl table').each((i, tbl) => {
        const rows = [];
        $(tbl).find('tr').each((_, tr) => {
          const cells = [];
          $(tr).find('td').each((__, td) => {
            cells.push({
              text: text($(td).text()),
              strong: text($(td).find('strong').first().text()) || null,
              link: $(td).find('a').first().attr('href') || null,
            });
          });
          if (cells.length) rows.push(cells);
        });
        if (rows.length) priceTables.push({ index: i, rows });
      });
      const { title } = extractTitle($);
      staticPages.push({
        slug: 'tsenyinaarendu',
        title: title || 'Прайс-лист',
        bodyHtml: '',
        excerpt: '',
        kind: 'price',
        legacyUrls: ['tsenyinaarendu'],
      });
      continue;
    }

    /* Статические страницы */
    const staticEntry = STATIC_PAGES.find(([p]) => p === path);
    if (staticEntry) {
      const $ = p.$;
      const { title } = extractTitle($);
      const body = $('.page-body');
      staticPages.push({
        slug: path.replace(/^\//, ''),
        title: title || path,
        bodyHtml: body.length ? sanitizeHtml(body.html()) : '',
        excerpt: text(body.text()).slice(0, 220),
        kind: staticEntry[1],
        legacyUrls: [path.replace(/^\//, '')],
      });
      continue;
    }

    const eq = parseEquipment(path, p);
    if (eq) {
      equipment.push(eq);
      continue;
    }

    /* Кейс определяется только по URL — иначе статьи с заголовком
       «Аренда генератора 200 кВт ...» тоже попали бы в кейсы. */
    const cat = classify(path);
    if (cat?.id === 'case') {
      const cs = parseCase(path, p);
      if (cs) {
        cases.push(cs);
      } else {
        unparsed.push(path);
      }
      continue;
    }

    const ar = parseArticle(path, p);
    if (ar) {
      articles.push(ar);
      continue;
    }

    unparsed.push(path);
  }

  /* Картинки кейсов — с индекса /nashiobekty */
  const caseImages = await scrapeCaseImages();
  let withPhoto = 0;
  for (const c of cases) {
    const img = caseImages.get(c.slug);
    if (img) {
      c.image = img;
      withPhoto++;
    }
  }
  console.log(`    кейсы с фотографией: ${withPhoto} из ${cases.length}`);

  console.log(
    `    техника: ${equipment.length}, статьи: ${articles.length}, кейсы: ${cases.length}, страницы: ${staticPages.length}`
  );
  if (unparsed.length) {
    console.log(`    НЕ РАСПОЗНАНО (${unparsed.length}): ${unparsed.join(', ')}`);
  }

  /* Дубли НЕ склеиваем.
     Попытка объединить позиции по строке «модели» склеила 8 разных
     компрессоров (Airman PDS185S, PDS185SC, PDS390SCW, Atlas Copco …)
     в одну позицию — у них одинаковый заголовок, но разное оборудование.
     Правило: каждый legacy-URL = отдельная страница. Потерять 13
     товарных страниц при миграции недопустимо. */
  const canonical = equipment;
  console.log(`    позиций (без склейки): ${canonical.length}\n`);

  /* Категории техники */
  const categoryIndex = {};
  for (const e of canonical) {
    (categoryIndex[e.category] ??= []).push(e);
  }

  /* Карта 301-редиректов: все legacy-URL, которые не стали каноническими */
  const redirects = {};

  /* 1. Дубли техники: /kompressornasmeny330 → /arendacompressoraairmanpds185s */
  for (const e of canonical) {
    for (const legacy of e.legacyUrls) {
      if (legacy !== e.slug) redirects[legacy] = e.slug;
    }
  }

  /* 2. Статьи и кейсы с несколькими адресами */
  for (const a of [...articles, ...cases, ...staticPages]) {
    for (const legacy of a.legacyUrls) {
      if (legacy !== a.slug) redirects[legacy] = a.slug;
    }
  }

  /* 3. Известные ручные соответствия */
  const MANUAL_REDIRECTS = {
    /* дубль каталога с дефисом */
    'arenda-generatorov': 'arendageneratorov',
    /* статьи с дефисами в slug: на genorg.ru таких страниц нет
       (сервер отдаёт главную), но они есть в sitemap старой CMS */
    'vidy-tipy-elektrostancij-plyusy-i-minusy-chast-pervaya-benzinovaya': 'poleznoe',
    'vidy-tipy-elektrostancij-plyusy-i-minusy-chast-vtoraya-gazovaya': 'poleznoe',
    'vidy-tipy-elektrostancij-plyusy-i-minusy-chast-tretya-dizelnaya': 'poleznoe',
  };
  Object.assign(redirects, MANUAL_REDIRECTS);

  /* Описания для страниц, где легаси-сайт их не содержал */
  const DESCRIPTIONS = {
    arendageneratorov:
      'Аренда дизельных генераторов от 8 до 800 кВт от собственника: AIRMAN, DENYO, Cummins. Все модели в наличии, доставка от 2 часов, ТО включён в тариф.',
    mobilnyegeneratory:
      'Аренда передвижных дизельных станций (ПЭС) от 8 до 400 кВт с оператором и топливом. Смена 8 часов, доставка по Москве и области от 2 часов.',
    arendakompressorov:
      'Аренда компрессоров AIRMAN от 5 до 17 м³/мин. Японское оборудование, доставка от 7 000 руб., ТО и обслуживание включены.',
    kompressornasmeny:
      'Аренда компрессоров по сменам: дизельные, бензиновые, передвижные. Расчёт стоимости смены 8 часов, доставка техники на объект.',
    arendamanipulatora:
      'Аренда кранов-манипуляторов HINO и ISUZU грузоподъёмностью 3–9 тонн со своим экипажем. Смена 8 часов, доставка по Москве и МО.',
    prodazhabu:
      'Продажа дизельных генераторов бывших в эксплуатации: Airman SDG, Cummins C350D5. Проверены, с гарантией, готовы к работе.',
    tsenyinaarendu:
      'Цены на аренду дизельных генераторов, передвижных станций, компрессоров и кранов-манипуляторов. Скидка 10% при аренде от 30 дней.',
    nashiobekty: 'Реальные объекты, где работало оборудование ДИЭН-Системс: стройки, торговые центры, рестораны и мероприятия в Москве и области.',
    poleznoe:
      'Статьи об аренде дизельных электростанций: как рассчитать мощность, когда нужен резерв, обслуживание генератора и техника безопасности.',
    dostavka:
      'Стоимость и сроки доставки дизельных генераторов по Москве и Московской области. Собственные краны-манипуляторы грузоподъёмностью 3–9 тонн.',
    prodazhatopliva: 'Продажа дизельного топлива с доставкой на объект в Москве и области. Объёмные поставки для генераторов, компрессоров и техники.',
    dopoborudovanie: 'Дополнительное оборудование к дизельным генераторам и компрессорам: топливные ёмкости, ГРЩ, силовые кабели, операторы.',
    contacts:
      'Контакты ДИЭН-Системс: телефон +7 (495) 540-52-92, e-mail, адрес базы в Химках (Ленинградское шоссе, 360Б). Приём заявок ежедневно 8:00–20:00.',
  };

  for (const sp of staticPages) {
    if (!sp.excerpt || sp.excerpt.length < 60) {
      sp.excerpt = DESCRIPTIONS[sp.slug] ?? '';
    }
  }

  /* Описания для позиций каталога: легаси-страницы их не содержали */
  for (const e of canonical) {
    if (!e.description || e.description.length < 80) {
      e.description =
        `${e.categoryLabel} ${e.model}${e.power ? `, ${e.power} ${e.powerUnit}` : ''}` +
        `${e.price ? `. Аренда от ${e.price.value} ₽${e.price.unit ? ' за ' + e.price.unit : ' в сутки'}` : ''}` +
        `. Доставка по Москве и области, ТО и подмена включены. Подбор и расчёт — бесплатно.`;
    }
  }

  /* Настройки */
  const settings = {
    company: 'ДИЭН-Системс',
    legalName: 'ООО «ДИЭН-Системс»',
    phone: '+7 (495) 540-52-92',
    phoneRaw: '+74955405292',
    email: 'diensystem@mail.ru',
    address: '141400, Московская обл., г. Химки, Ленинградское шоссе, 360Б',
    city: 'Москва и Московская область',
    foundedYear: 2007,
    fleetMW: 64,
    deliveryHours: 2,
    rating: 4.9,
    ratingCount: 47,
    workingHours: 'Ежедневно, 8:00–20:00',
    discountFromDays: 30,
    discountPercent: 10,
    yandexReviewsUrl:
      'https://yandex.ru/maps/org/dien_sistems/1088163471/reviews/?ll=37.351851%2C55.951404&z=16',
  };

  const seed = {
    meta: {
      source: ORIGIN,
      migratedAt: new Date().toISOString(),
      legacyUrlCount: pages.size,
      equipmentCount: canonical.length,
      articleCount: articles.length,
      caseCount: cases.length,
      pageCount: staticPages.length,
    },
    settings,
    categories: [
      { id: 'generator', label: 'Дизельные генераторы', slug: 'arendageneratorov', unit: 'кВт' },
      { id: 'pes', label: 'Передвижные станции (ПЭС)', slug: 'mobilnyegeneratory', unit: 'кВт' },
      { id: 'compressor', label: 'Компрессоры', slug: 'arendakompressorov', unit: 'бар' },
      { id: 'compressor-shift', label: 'Компрессоры на смену', slug: 'kompressornasmeny', unit: 'бар' },
      { id: 'manipulator', label: 'Краны-манипуляторы', slug: 'arendamanipulatora', unit: 'т' },
      { id: 'used', label: 'Продажа б/у техники', slug: 'prodazhabu', unit: 'кВт' },
    ],
    equipment: canonical,
    articles,
    cases,
    pages: staticPages,
    priceTables,
    redirects,
  };

  await fs.mkdir(path.join(ROOT, 'content'), { recursive: true });
  await fs.writeFile(path.join(ROOT, 'content', 'seed.json'), JSON.stringify(seed, null, 2), 'utf8');

  console.log('═══ Готово ═══');
  console.log(`  content/seed.json`);
  console.log(
    `  техника: ${canonical.length} · статьи: ${articles.length} · кейсы: ${cases.length} · страницы: ${staticPages.length} · прайс-таблиц: ${priceTables.length}`
  );
  console.log(`  301-редиректов: ${Object.keys(redirects).length}`);
  console.log(`  legacy URL всего: ${pages.size}`);
})();

/** Ранг slug'а: предпочитаем «новые» адреса каталога */
function rankSlug(slug) {
  if (slug.startsWith('arendacompressora')) return 0;
  if (slug.startsWith('arendamanipulatora')) return 0;
  if (slug.startsWith('arendapes')) return 0;
  if (slug.startsWith('arendadizelnogogeneratora')) return 0;
  if (slug.startsWith('kompressornasmeny')) return 2;
  return 1;
}
