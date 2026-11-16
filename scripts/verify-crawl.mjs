/**
 * Проверка миграции 1:1.
 *
 *   OLD_URL=https://genorg.ru  NEW_URL=http://127.0.0.1:3100
 *   node scripts/verify-crawl.mjs
 *
 * Что проверяем:
 *   1. Полноту URL   — каждый URL боевого сайта отдаёт 200 на новом.
 *   2. Метаданные    — title, description, h1, canonical на каждой странице.
 *   3. Микроразметку — JSON-LD присутствует.
 *   4. Мягкие 404    — неизвестный URL должен отдавать 404, а не 200.
 *   5. Sitemap       — все URL из карты сайта живые.
 *
 * Это главный предохранитель перед переключением домена.
 */
const OLD_URL = (process.env.OLD_URL ?? 'https://genorg.ru').replace(/\/$/, '');
const NEW_URL = (process.env.NEW_URL ?? 'http://127.0.0.1:3100').replace(/\/$/, '');

const UA = 'Mozilla/5.0 (compatible; genorg-migration-check/1.0)';
const CONCURRENCY = 6;

async function fetchText(url, method = 'GET') {
  const res = await fetch(url, { method, headers: { 'User-Agent': UA }, redirect: 'manual' });
  const body = method === 'GET' ? await res.text() : '';
  return { status: res.status, body, location: res.headers.get('location') };
}

/* ─── Обход старого сайта ────────────────────────────────────────────── */

async function crawlOld() {
  const found = new Set(['/']);
  const queue = ['/'];
  const seen = new Set();

  while (queue.length) {
    const path = queue.shift();
    if (seen.has(path)) continue;
    seen.add(path);

    let res;
    try {
      res = await fetchText(OLD_URL + path);
    } catch {
      continue;
    }
    if (res.status !== 200) continue;

    for (const m of res.body.matchAll(/href="([^"#?]+)"/g)) {
      const href = m[1];
      if (!href.startsWith('/') || href.startsWith('//')) continue;
      if (!/\/[a-z0-9]/.test(href)) continue; // отсекаем /site/css/...
      if (/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff2?|xml|txt)$/i.test(href)) continue;
      const clean = href.replace(/\/$/, '') || '/';
      if (!found.has(clean)) {
        found.add(clean);
        queue.push(clean);
      }
    }
  }
  return [...found].sort();
}

/* ─── Проверка одной страницы на новом сайте ─────────────────────────── */

async function checkPage(path) {
  const issues = [];
  let status = 0;

  try {
    let res = await fetchText(NEW_URL + path);
    status = res.status;

    /* 3xx — это наши 301-редиректы. Проверяем, что цель живая. */
    if (res.status >= 300 && res.status < 400 && res.location) {
      const target = res.location.startsWith('http')
        ? res.location
        : NEW_URL + res.location;
      const final = await fetchText(target);
      if (final.status !== 200) {
        return { path, status, issues: [`редирект на ${res.location} → HTTP ${final.status}`] };
      }
      return { path, status, issues: [], redirectedTo: res.location };
    }

    if (res.status !== 200) {
      return { path, status, issues: [`HTTP ${res.status}`] };
    }

    const html = res.body;

    const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1]?.trim();
    const desc = (html.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"/i) || [])[1];
    const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) =>
      m[1].replace(/<[^>]+>/g, '').trim()
    );
    const canonical = (html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]*)"/i) || [])[1];
    const ldjson = (html.match(/application\/ld\+json/g) || []).length;

    if (!title) issues.push('нет <title>');
    if (!desc) issues.push('нет description');
    if (h1s.length === 0) issues.push('нет <h1>');
    if (h1s.length > 1) issues.push(`${h1s.length} <h1> (должен быть 1)`);
    if (!canonical) issues.push('нет canonical');
    if (!ldjson) issues.push('нет JSON-LD');
    if (/<meta[^>]+name="viewport"[^>]+user-scalable=no/i.test(html)) {
      issues.push('user-scalable=no');
    }
    if (!/<html[^>]+lang="ru"/i.test(html)) issues.push('нет lang="ru"');

    return { path, status, issues, title: title?.slice(0, 60) };
  } catch (e) {
    return { path, status: 0, issues: [`ошибка: ${e.message}`] };
  }
}

async function mapLimit(items, limit, fn) {
  const out = [];
  let i = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

/* ─── Основной прогон ─────────────────────────────────────────────────── */

(async () => {
  console.log('═══ Проверка миграции 1:1 ═══\n');
  console.log(`старый: ${OLD_URL}`);
  console.log(`новый:  ${NEW_URL}\n`);

  console.log('[1] Обход старого сайта…');
  const oldUrls = await crawlOld();
  console.log(`    найдено URL: ${oldUrls.length}`);

  if (process.env.DUMP_OLD_URLS) {
    console.log('\n--- инвентарь legacy-сайта ---');
    for (const u of oldUrls) console.log('  ' + u);
    console.log('--- конец ---\n');
  }
  console.log();

  console.log('[2] Проверка страниц на новом сайте…');
  const results = await mapLimit(oldUrls, CONCURRENCY, checkPage);
  const failed = results.filter(
    (r) => r.issues.length || (r.status !== 200 && !r.redirectedTo)
  );
  const redirected = results.filter((r) => r.redirectedTo);
  console.log(`    проверено: ${results.length}, с замечаниями: ${failed.length}, редиректов: ${redirected.length}\n`);

  console.log('[3] Проверка мягких 404…');
  const soft = await fetchText(`${NEW_URL}/__definitely-not-a-page-${Date.now()}`);
  const softOk = soft.status === 404;
  console.log(`    неизвестный URL → HTTP ${soft.status} ${softOk ? '✓' : '✗ (нужен 404)'}\n`);

  console.log('[4] Проверка sitemap.xml…');
  const sm = await fetchText(`${NEW_URL}/sitemap.xml`);
  const smUrls = [...sm.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  let deadSm = 0;
  for (const u of smUrls) {
    const p = new URL(u).pathname;
    const r = await fetchText(NEW_URL + p);
    /* Редирект — не мёртвая ссылка, но в sitemap канонический адрес
       быть не должен: в карте попадают только конечные URL. */
    if (r.status >= 300 && r.status < 400) {
      deadSm++;
      console.log(`    редирект в sitemap (лишний): ${p} → ${r.location}`);
      continue;
    }
    if (r.status !== 200) {
      deadSm++;
      console.log(`    недоступен в sitemap: ${p} → HTTP ${r.status}`);
    }
  }
  console.log(`    URL в sitemap: ${smUrls.length}, недоступных: ${deadSm}\n`);

  /* ─── Отчёт ─── */
  console.log('═══ ИТОГ ═══');
  if (failed.length === 0 && softOk && deadSm === 0) {
    console.log(`✓ Все ${oldUrls.length} URL перенесены без потерь.`);
    console.log('  Замечаний по метаданным нет.');
    console.log('  Мягких 404 нет, sitemap чистый.');
  } else {
    console.log(`✗ Замечаний: ${failed.length}\n`);
    for (const f of failed) {
      console.log(`  ${f.path}`);
      console.log(`    ${f.issues.join(', ')}`);
      if (f.title) console.log(`    title: ${f.title}`);
    }
    if (!softOk) console.log(`\n  Мягкий 404: неизвестный URL вернул ${soft.status}, нужен 404`);
    if (deadSm) console.log(`\n  В sitemap ${deadSm} недоступных URL`);
  }

  process.exit(failed.length === 0 && softOk && deadSm === 0 ? 0 : 1);
})();
