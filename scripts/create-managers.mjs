/**
 * Создание менеджеров в админке Strapi.
 *
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/create-managers.mjs
 *
 * Создаёт учётные записи с ролями:
 *   editor@genorg.ru  — Editor  (контент-менеджер: каталог, статьи, кейсы)
 *   author@genorg.ru  — Author  (автор: только свои статьи)
 *
 * Вход в админку — обычная страница логина (email + пароль),
 * без каких-либо токенов на стороне фронтенда.
 */
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

/**
 * Менеджеры админки.
 *
 * Пароли берутся ТОЛЬКО из переменных окружения — в коде их быть
 * не должно: репозиторий может оказаться публичным. Значения хранятся
 * в .env (в .gitignore) и в файле с доступами у владельца сайта.
 */
const MANAGERS = [
  {
    email: process.env.EDITOR_EMAIL ?? 'editor@genorg.ru',
    password: process.env.EDITOR_PASSWORD ?? '',
    firstname: 'Контент-менеджер',
    lastname: '',
    role: 'strapi-editor',
  },
  {
    email: process.env.AUTHOR_EMAIL ?? 'author@genorg.ru',
    password: process.env.AUTHOR_PASSWORD ?? '',
    firstname: 'Автор',
    lastname: '',
    role: 'strapi-author',
  },
];

/* Без пароля пользователя не создать — подсказываем, что делать */
for (const m of MANAGERS) {
  if (!m.password) {
    console.error(
      `  ! Нужен пароль для ${m.email}. Задайте переменную окружения ` +
        `(${m.email.startsWith('editor') ? 'EDITOR' : 'AUTHOR'}_PASSWORD) и повторите.`
    );
    process.exit(1);
  }
}

/** Strapi в разных эндпоинтах отдаёт списки по-разному:
 *  массив, { results: [...] } или { data: [...] }. */
function asArray(v) {
  if (Array.isArray(v)) return v;
  if (Array.isArray(v?.results)) return v.results;
  if (Array.isArray(v?.data)) return v.data;
  return [];
}

(async () => {
  const login = await api('/admin/login', 'POST', { email: EMAIL, password: PASSWORD });
  if (login.status !== 200) {
    console.error('  Ошибка входа:', JSON.stringify(login.data).slice(0, 200));
    process.exit(1);
  }
  const auth = { Authorization: `Bearer ${login.data.data.token}` };
  console.log(`Вход как ${EMAIL}\n`);

  /* Роли */
  const rolesRes = await api('/admin/roles', 'GET', null, auth);
  const roles = asArray(rolesRes.data);
  const roleByCode = new Map(roles.map((r) => [r.code, r]));
  console.log('роли в системе:', roles.map((r) => `${r.code}(${r.id})`).join(', '), '\n');

  /* Уже созданные пользователи */
  const usersRes = await api('/admin/users?pagination[pageSize]=100', 'GET', null, auth);
  const existing = new Map(asArray(usersRes.data).map((u) => [u.email, u]));

  for (const m of MANAGERS) {
    const role = roleByCode.get(m.role);
    if (!role) {
      console.error(`  ! роль ${m.role} не найдена`);
      continue;
    }

    const found = existing.get(m.email);
    let userId = found?.id;

    if (!userId) {
      /* Шаг 1: создаём пользователя без пароля.
         Strapi 5 не принимает password в POST /admin/users. */
      const res = await api('/admin/users', 'POST', {
        email: m.email,
        firstname: m.firstname,
        lastname: m.lastname,
        roles: [role.id],
      }, auth);
      if (res.status >= 300) {
        console.error(`  ✗ ${m.email}: ${JSON.stringify(res.data).slice(0, 180)}`);
        continue;
      }
      userId = res.data?.data?.id ?? res.data?.data?.documentId;
      console.log(`  ✓ создан ${m.email}`);
    } else {
      console.log(`  = ${m.email} уже существует`);
    }

    /* Шаг 2: назначаем пароль и активность через PUT */
    const put = await api(`/admin/users/${userId}`, 'PUT', {
      firstname: m.firstname,
      lastname: m.lastname,
      password: m.password,
      isActive: true,
      roles: [role.id],
    }, auth);

    console.log(
      put.status < 300
        ? `  ✓ ${m.email} — пароль установлен, роль ${role.name}`
        : `  ✗ ${m.email}: ${JSON.stringify(put.data).slice(0, 180)}`
    );
  }

  console.log('\nвсе пользователи админки:');
  const list = await api('/admin/users?pagination[pageSize]=100', 'GET', null, auth);
  for (const u of asArray(list.data)) {
    const uRoles = await api(`/admin/users/${u.id}/roles`, 'GET', null, auth);
    const names = asArray(uRoles.data).map((r) => r.name).join(', ');
    console.log(`  ${String(u.email).padEnd(26)} активен=${u.isActive}  роли: ${names}`);
  }
})();
