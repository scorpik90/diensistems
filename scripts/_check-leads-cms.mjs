/** Проверка: заявка сохранилась в CMS и её видно в админке */
import fs from 'node:fs';

const tokens = JSON.parse(fs.readFileSync('.strapi-tokens.json', 'utf8'));
const H = { Authorization: `Bearer ${tokens['genorg-read']}` };

const res = await fetch('http://127.0.0.1:1337/api/leads?pagination[pageSize]=10&sort=createdAt:desc', { headers: H });
const body = await res.json();

console.log(`статус: ${res.status}, записей: ${(body.data ?? []).length}`);
for (const e of body.data ?? []) {
  const a = e.attributes ?? e;
  console.log(`  • ${a.name} | ${a.phone} | ${a.topic ?? '—'} | статус: ${a.status}`);
  console.log(`    сообщение: ${String(a.message ?? '—').slice(0, 60)}`);
  console.log(`    источник: ${a.source ?? '—'} | позиция: ${a.orderItem ?? '—'}`);
}

/* Проверяем, что запись создаётся с правильным статусом и что фильтр по статусу работает */
const byStatus = await fetch('http://127.0.0.1:1337/api/leads?filters[status][$eq]=new&pagination[pageSize]=5', { headers: H });
const j = await byStatus.json();
console.log(`\nсо статусом «new»: ${(j.data ?? []).length}`);

/* Сколько всего заявок накопилось за проверки */
console.log(`всего заявок в CMS: ${body.meta?.pagination?.total ?? (body.data ?? []).length}`);
