const html = await (await fetch('http://127.0.0.1:3100/dizelgeneratorychtoetotakoe')).text();
const d = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/i)?.[1] ?? '';
console.log('длина:', d.length);
console.log('текст:', d);
const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '';
console.log('title:', t.length, t);
