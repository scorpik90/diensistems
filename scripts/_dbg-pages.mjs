import fs from 'node:fs';

const token = JSON.parse(fs.readFileSync('.strapi-tokens.json', 'utf8'))['genorg-read'];
const H = { Authorization: `Bearer ${token}` };

const res = await fetch('http://127.0.0.1:1337/api/pages?pagination[pageSize]=50&sort=slug:asc', { headers: H });
const j = await res.json();

console.log(`страниц в CMS: ${(j.data ?? []).length}`);
for (const e of j.data ?? []) {
  const a = e.attributes ?? e;
  console.log(`  ${String(a.kind).padEnd(9)} ${a.slug.padEnd(38)} ${a.title?.slice(0, 40)}`);
}
