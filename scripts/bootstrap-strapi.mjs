/**
 * Первичная инициализация Strapi после сброса базы.
 *
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/bootstrap-strapi.mjs
 *
 * Делает три вещи, каждая идемпотентна:
 *   1) создаёт первого администратора (POST /admin/register-admin);
 *   2) создаёт API-токены genorg-read и genorg-write;
 *   3) создаёт менеджеров editor@genorg.ru и author@genorg.ru.
 *
 * После сброса БД админа и токенов нет — админку не открыть.
 * Этот скрипт поднимает всё с нуля.
 */
import fs from 'node:fs';

const BASE = (process.env.STRAPI_URL ?? 'http://127.0.0.1:1337').replace(/\/$/, '');
const EMAIL = process.env.ADMIN_EMAIL ?? 'admin@genorg.ru';
const PASSWORD = process.env.ADMIN_PASSWORD ?? '';

if (!PASSWORD) {
  console.error('Нужен ADMIN_PASSWORD.');
  process.exit(1);
}

async function api(path, method = 'GET', body, headers = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

(async () => {
  /* ── 1. Первый администратор ────────────────────────────────────── */
  let jwt = null;

  const login = await api('/admin/login', 'POST', { email: EMAIL, password: PASSWORD });
  if (login.status === 200) {
    jwt = login.data?.data?.token;
    console.log(`  ✓ админ ${EMAIL} уже существует — вход выполнен`);
  } else {
    const reg = await api('/admin/register-admin', 'POST', {
      email: EMAIL,
      password: PASSWORD,
      firstname: 'Администратор',
      lastname: 'ДИЭН-Системс',
    });
    if (reg.status === 200 || reg.status === 201) {
      jwt = reg.data?.data?.token ?? reg.data?.token;
      console.log(`  ✓ создан админ ${EMAIL}`);
    } else {
      console.error('  ! не удалось создать админа:', JSON.stringify(reg.data).slice(0, 300));
      process.exit(1);
    }
  }

  const auth = { Authorization: `Bearer ${jwt}` };

  /* Токен, выданный при регистрации, может не иметь полных прав —
     перезаходим, чтобы получить полноценный сеант администратора. */
  const relogin = await api('/admin/login', 'POST', { email: EMAIL, password: PASSWORD });
  if (relogin.status === 200 && relogin.data?.data?.token) {
    jwt = relogin.data.data.token;
    auth.Authorization = `Bearer ${jwt}`;
    console.log('  ✓ повторный вход администратора');
  }

  /* ── 2. API-токены ──────────────────────────────────────────────── */
  const list = await api('/admin/api-tokens', 'GET', null, auth);
  const existing = Array.isArray(list.data?.data) ? list.data.data : [];
  for (const t of existing) {
    if (t.name === 'genorg-read' || t.name === 'genorg-write') {
      await api(`/admin/api-tokens/${t.id}`, 'DELETE', null, auth);
      console.log(`  удалён прежний токен ${t.name}`);
    }
  }

  const tokens = {};
  for (const w of [
    { name: 'genorg-read', type: 'read-only' },
    { name: 'genorg-write', type: 'full-access' },
  ]) {
    const res = await api('/admin/api-tokens', 'POST', { name: w.name, type: w.type, lifespan: null }, auth);
    const key = res.data?.data?.accessKey ?? res.data?.accessKey;
    if (![200, 201].includes(res.status) || !key) {
      console.error(`  ! не удалось создать ${w.name}:`, JSON.stringify(res.data).slice(0, 240));
      continue;
    }
    tokens[w.name] = key;
    console.log(`  ✓ токен ${w.name} (${w.type})`);
  }

  if (Object.keys(tokens).length) {
    fs.writeFileSync('.strapi-tokens.json', JSON.stringify(tokens, null, 2), 'utf8');
    console.log('\nСохранено в .strapi-tokens.json');

    /* Прокидываем токены в .env — оттуда их берёт Next.js */
    const envPath = '.env';
    let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    env = env
      .split('\n')
      .filter((l) => !/^STRAPI_TOKEN=/.test(l))
      .join('\n');
    env += `\nSTRAPI_TOKEN=${tokens['genorg-write']}\n`;
    fs.writeFileSync(envPath, env, 'utf8');
    console.log('  Обновлён .env (STRAPI_TOKEN)');
  }

  /* ── 3. Менеджеры ───────────────────────────────────────────────── */
  /* Создание менеджеров живёт в create-managers.mjs: в Strapi 5 пароль
     нельзя передать при создании пользователя — только вторым запросом. */
  console.log('\nМенеджеры создаются отдельным скриптом:');
  console.log('  node scripts/create-managers.mjs');
  console.log('\nГотово. Вход в админку: ' + BASE + '/admin');
})();
