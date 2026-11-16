/**
 * Проверка менеджеров админки Strapi.
 *
 *   node scripts/verify-managers.mjs
 *
 * Показывает список пользователей с ролями и проверяет, что каждый
 * действительно может войти. Если пароль забыт — скрипт это покажет.
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/* better-sqlite3 установлен в проекте Strapi — подключаем оттуда */
const require = createRequire(path.join(__dirname, '..', 'cms-admin', 'package.json'));
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, '..', 'cms-admin', '.tmp', 'data.db'), { readonly: true });

console.log('пользователи админки:');
const rows = db
  .prepare(
    `select u.id, u.email, u.firstname, u.lastname, u.is_active, u.blocked, u.locale,
            group_concat(r.name) as roles
       from admin_users u
       left join admin_users_roles_lnk l on l.user_id = u.id
       left join admin_roles r on r.id = l.role_id
      group by u.id order by u.id`
  )
  .all();
for (const r of rows) {
  console.log(
    `  id=${r.id}  ${String(r.email).padEnd(26)} активен=${r.is_active}  роли: ${r.roles ?? '—'}  язык: ${r.locale ?? '—'}`
  );
}
db.close();

/* Проверка входа каждого (пароли — из переменных окружения) */
console.log('\nпроверка входа:');
const BASE = process.env.STRAPI_URL ?? 'http://127.0.0.1:1337';

const candidates = [
  [process.env.ADMIN_EMAIL ?? 'admin@genorg.ru', process.env.ADMIN_PASSWORD],
  [process.env.EDITOR_EMAIL ?? 'editor@genorg.ru', process.env.EDITOR_PASSWORD],
  [process.env.AUTHOR_EMAIL ?? 'author@genorg.ru', process.env.AUTHOR_PASSWORD],
].filter(([, p]) => p);

for (const [email, password] of candidates) {
  const res = await fetch(`${BASE}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  const ok = res.status === 200 && !!body?.data?.token;
  console.log(
    `  ${ok ? '✓' : '✗'} ${email.padEnd(26)} HTTP ${res.status}${ok ? '' : ' — ' + (body?.error?.message ?? '')}`
  );
  await new Promise((r) => setTimeout(r, 1500));
}

if (!candidates.length) {
  console.log('  (пароли не заданы — задайте ADMIN_PASSWORD / EDITOR_PASSWORD / AUTHOR_PASSWORD)');
}
