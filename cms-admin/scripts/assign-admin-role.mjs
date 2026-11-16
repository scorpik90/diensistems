/**
 * Назначение ролей администраторам Strapi.
 *
 *   node scripts/assign-admin-role.mjs
 *
 * Нужно после прямого вставки в БД: у пользователя без записи в
 * admin_users_roles_lnk нет ни одной роли, и он не может войти в админку.
 *
 * Внимание: таблица связи называется admin_users_roles_lnk (не admin_users_roles).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const DB = path.join(process.cwd(), '.tmp', 'data.db');
const db = new Database(DB);

console.log('роли в системе:');
const roles = db.prepare('select id, name, code from admin_roles').all();
for (const r of roles) console.log('  ' + JSON.stringify(r));

const superAdmin = roles.find((r) => r.code === 'strapi-super-admin');
if (!superAdmin) {
  console.error('Не найдена роль strapi-super-admin');
  process.exit(1);
}

const users = db.prepare('select id, email from admin_users').all();
for (const u of users) {
  const n = db
    .prepare('select count(*) as n from admin_users_roles_lnk where user_id = ? and role_id = ?')
    .get(u.id, superAdmin.id).n;
  if (n === 0) {
    db.prepare(
      'insert into admin_users_roles_lnk (user_id, role_id, role_ord, user_ord) values (?,?,1,1)'
    ).run(u.id, superAdmin.id);
    console.log(`  → ${u.email}: назначена Super Admin`);
  } else {
    console.log(`  = ${u.email}: Super Admin уже есть`);
  }
}

console.log('\nитог:');
for (const r of db
  .prepare(
    `select u.email, group_concat(ro.name) as roles
       from admin_users u
       left join admin_users_roles_lnk l on l.user_id = u.id
       left join admin_roles ro on ro.id = l.role_id
      group by u.id`
  )
  .all()) {
  console.log('  ' + JSON.stringify(r));
}

db.close();
