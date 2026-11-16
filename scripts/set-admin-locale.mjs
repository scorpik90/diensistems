/**
 * Переключение языка интерфейса админки на русский для всех менеджеров.
 *
 *   node scripts/set-admin-locale.mjs
 *
 * В Strapi 5 предпочтение называется preferedLanguage (с опечаткой в API).
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(__dirname, '..', 'cms-admin', 'package.json'));
const Database = require('better-sqlite3');

const BASE = process.env.STRAPI_URL ?? 'http://127.0.0.1:1337';

const db = new Database(path.join(__dirname, '..', 'cms-admin', '.tmp', 'data.db'));
const users = db.prepare('select id, email, prefered_language from admin_users').all();
db.close();

console.log('язык админки до:');
for (const u of users) console.log(`  ${u.email.padEnd(26)} ${u.prefered_language ?? '—'}`);

/* Через админ-API */
const login = await fetch(`${BASE}/admin/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: process.env.ADMIN_EMAIL ?? 'admin@genorg.ru',
    password: process.env.ADMIN_PASSWORD ?? '',
  }),
}).then((r) => r.json());

if (!login?.data?.token) {
  console.error('  не удалось войти — ставлю язык напрямую в БД');
} else {
  const auth = { Authorization: `Bearer ${login.data.token}`, 'Content-Type': 'application/json' };
  for (const u of users) {
    const res = await fetch(`${BASE}/admin/users/${u.id}`, {
      method: 'PUT',
      headers: auth,
      body: JSON.stringify({ preferedLanguage: 'ru' }),
    });
    console.log(`  ${u.email.padEnd(26)} → HTTP ${res.status}`);
    await new Promise((r) => setTimeout(r, 600));
  }
}

/* Проверка и установка.
   В Strapi 5 язык интерфейса админки берётся из колонки locale
   (i18n-локаль админ-пользователя), а prefered_language — устаревшее поле. */
const db2 = new Database(path.join(__dirname, '..', 'cms-admin', '.tmp', 'data.db'));
db2.prepare('update admin_users set prefered_language = ?, locale = ?').run('ru', 'ru');
const after = db2.prepare('select email, prefered_language, locale from admin_users').all();
console.log('\nязык админки после:');
for (const u of after) {
  console.log(`  ${u.email.padEnd(26)} prefered=${u.prefered_language ?? '—'}  locale=${u.locale ?? '—'}`);
}
db2.close();
