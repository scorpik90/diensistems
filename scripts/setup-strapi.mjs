/**
 * Вход в админку Strapi и создание API-токенов.
 *
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/setup-strapi.mjs
 *
 * Создаёт два токена:
 *   genorg-read   — read-only, для фронтенда (Next.js)
 *   genorg-write  — full-access, для скрипта импорта данных
 *
 * Результат пишется в .strapi-tokens.json и в .env проекта.
 */
import fs from 'node:fs';

const BASE = process.env.STRAPI_URL ?? 'http://127.0.0.1:1337';
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
  console.log(`Вход: ${BASE} как ${EMAIL}`);

  const login = await api('/admin/login', 'POST', { email: EMAIL, password: PASSWORD });
  if (login.status !== 200) {
    console.error('  Ошибка входа:', JSON.stringify(login.data).slice(0, 300));
    process.exit(1);
  }
  const jwt = login.data?.data?.token;
  const auth = { Authorization: `Bearer ${jwt}` };
  console.log('  ✓ авторизация');

  /* Удаляем прежние токены с нашими именами */
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
    /* Ключ возвращается только в момент создания.
       Strapi отвечает 201 Created — не только 200. */
    const key = res.data?.data?.accessKey ?? res.data?.accessKey;
    if (![200, 201].includes(res.status) || !key) {
      console.error(`  ! не удалось создать ${w.name}:`, JSON.stringify(res.data).slice(0, 240));
      continue;
    }
    tokens[w.name] = key;
    console.log(`  ✓ токен ${w.name} (${w.type})`);
  }

  fs.writeFileSync('.strapi-tokens.json', JSON.stringify(tokens, null, 2), 'utf8');
  console.log('\nСохранено в .strapi-tokens.json');

  /* Проверяем доступ */
  for (const [name, key] of Object.entries(tokens)) {
    const res = await api('/api/equipment?pagination[pageSize]=1', 'GET', null, {
      Authorization: `Bearer ${key}`,
    });
    console.log(`  проверка ${name}: /api/equipment → HTTP ${res.status}`);
  }
})();
