/** Проверка заголовков h1/h2 и сниппетов с корректными регулярками */
const BASE = 'http://127.0.0.1:3100';

const sm = await (await fetch(`${BASE}/sitemap.xml`)).text();
const urls = [...new Set([...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]))];

console.log(`URL в sitemap: ${urls.length} (уникальных)`);

const noH1 = [];
const noH2 = [];
const shortTitle = [];
const shortDesc = [];
const thin = [];

for (const u of urls) {
  /* Sitemap содержит абсолютные URL боевого домена — заменяем на локальный,
     иначе проверяем старый сайт, а не наш */
  const local = u.replace('https://genorg.ru', BASE);
  const html = await (await fetch(local)).text();
  const path = u.replace('https://genorg.ru', '') || '/';

  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) =>
    m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  );
  const h2s = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) =>
    m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  );
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? '';
  const desc = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/i)?.[1] ?? '';

  /* Считаем длину видимого текста: в HTML сущности занимают
     по 6 символов («&quot;» вместо «"») и иначе длину искажает */
  const decode = (s) =>
    s
      .replace(/&quot;/g, '"')
      .replace(/&laquo;/g, '«')
      .replace(/&raquo;/g, '»')
      .replace(/&ndash;/g, '–')
      .replace(/&mdash;/g, '—')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&');
  const titleLen = decode(title).length;
  const descLen = decode(desc).length;

  const words = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ').length;

  if (h1s.length === 0) noH1.push(path);
  if (h2s.length === 0) noH2.push(path);
  if (titleLen < 30 || titleLen > 70) shortTitle.push(`${path} (${titleLen})`);
  if (descLen < 90 || descLen > 180) shortDesc.push(`${path} (${descLen})`);
  if (words < 200) thin.push(`${path} (${words} слов)`);
}

const show = (title, arr) => {
  console.log(`\n=== ${title}: ${arr.length} ===`);
  arr.forEach((a) => console.log('  ' + a));
};

show('без h1', noH1);
show('без h2', noH2);
show('title вне 30–70', shortTitle);
show('description вне 90–180', shortDesc);
show('мало текста (<200 слов)', thin);
