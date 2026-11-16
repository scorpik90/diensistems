/**
 * Проверка deploy-конфигурации без Docker.
 *
 *   node scripts/_check-deploy.mjs
 *
 * Docker на этой машине недоступен, поэтому compose-файл проверяем
 * разбором YAML и сверкой с тем, что ожидает deploy.sh.
 */
import fs from 'node:fs';

const composePath = 'docker-compose.yml';
const deployPath = 'deploy/deploy.sh';

let bad = 0;
const fail = (m) => {
  console.log(`  ✗ ${m}`);
  bad++;
};
const ok = (m) => console.log(`  ✓ ${m}`);

/* ─── 1. Разбор YAML (минимальный разбор структуры compose) ─── */

const raw = fs.readFileSync(composePath, 'utf8');

/* Проверяем отступы и наличие ключевых блоков */
const services = ['db:', 'strapi:', 'web:', 'caddy:'];
for (const s of services) {
  if (new RegExp(`^  ${s}`, 'm').test(raw)) ok(`сервис ${s.replace(':', '')} объявлен`);
  else fail(`нет сервиса ${s.replace(':', '')}`);
}

/* Табы в YAML недопустимы */
if (/\t/.test(raw)) fail('в YAML есть табуляции — YAML их не допускает');
else ok('табуляций нет');

/* Все ${переменные} должны быть в .env-примере или генерироваться скриптом */
const vars = [...new Set([...raw.matchAll(/\$\{([A-Z_][A-Z0-9_]*)\}/g)].map((m) => m[1]))];
const deploy = fs.readFileSync(deployPath, 'utf8');
const missing = vars.filter((v) => !deploy.includes(v));
if (missing.length) fail(`переменные не объявлены в deploy.sh: ${missing.join(', ')}`);
else ok(`все ${vars.length} переменных объявлены в deploy.sh`);

/* ─── 2. Секреты, которые обязан генерировать скрипт ─── */

const required = [
  'POSTGRES_PASSWORD', 'APP_KEYS', 'API_TOKEN_SALT', 'ADMIN_JWT_SECRET',
  'TRANSFER_TOKEN_SALT', 'JWT_SECRET', 'ENCRYPTION_KEY', 'STRAPI_ADMIN_JWT_SECRET',
  'STRAPI_TOKEN',
];
for (const v of required) {
  if (deploy.includes(`${v}=`)) ok(`${v} генерируется`);
  else fail(`${v} не генерируется`);
}

/* APP_KEYS должен состоять из четырёх ключей */
if (/APP_KEYS=\$\(gen\),\$\(gen\),\$\(gen\),\$\(gen\)/.test(deploy)) ok('APP_KEYS — четыре ключа');
else fail('APP_KEYS должен содержать четыре ключа через запятую');

/* ─── 3. Порядок шагов в скрипте ─── */

const order = [
  ['docker compose up -d db', 'PostgreSQL'],
  ['docker compose build strapi', 'сборка CMS'],
  ['docker compose up -d strapi', 'запуск CMS'],
  ['import-to-strapi.mjs --reset', 'импорт данных'],
  ['docker compose build web', 'сборка сайта'],
  ['docker compose up -d web', 'запуск сайта'],
  ['docker compose up -d caddy', 'reverse proxy и SSL'],
  ['create-managers.mjs', 'учётные записи'],
];
let last = -1;
for (const [needle, title] of order) {
  const pos = deploy.indexOf(needle);
  if (pos < 0) {
    fail(`нет шага «${title}»`);
    continue;
  }
  if (pos < last) {
    fail(`шаг «${title}» идёт не по порядку`);
    continue;
  }
  last = pos;
  ok(`шаг «${title}» на месте`);
}

/* Критично: сайт собирается ПОСЛЕ старта CMS, иначе generateStaticParams
   не найдёт данные (в проекте нет оффлайн-фолбэка) */
const strapiUp = deploy.indexOf('docker compose up -d strapi');
const webBuild = deploy.indexOf('docker compose build web');
if (strapiUp > 0 && webBuild > strapiUp) {
  ok('сайт собирается после старта CMS (generateStaticParams тянет данные из CMS)');
} else {
  fail('порядок нарушен: сборка сайта должна идти после запуска CMS');
}

/* ─── 4. Вспомогательные файлы ─── */

for (const f of ['deploy/Dockerfile.web', 'deploy/Dockerfile.strapi', 'deploy/Caddyfile']) {
  if (fs.existsSync(f)) ok(`${f} на месте`);
  else fail(`нет ${f}`);
}

/* В Dockerfile.strapi должен быть rebuild better-sqlite3 (alpine) */
const dfStrapi = fs.readFileSync('deploy/Dockerfile.strapi', 'utf8');
if (/npm rebuild better-sqlite3/.test(dfStrapi)) ok('better-sqlite3 пересобирается под alpine');
else fail('в Dockerfile.strapi нет npm rebuild better-sqlite3');

/* В Dockerfile.web должен копироваться .next и public */
const dfWeb = fs.readFileSync('deploy/Dockerfile.web', 'utf8');
for (const f of ['/app/.next', '/app/public']) {
  if (dfWeb.includes(f)) ok(`Dockerfile.web копирует ${f}`);
  else fail(`Dockerfile.web не копирует ${f}`);
}

/* Caddy: должны быть оба домена */
const caddy = fs.readFileSync('deploy/Caddyfile', 'utf8');
if (caddy.includes('{$SITE_URL}')) ok('Caddy слушает домен сайта');
else fail('в Caddyfile нет {$SITE_URL}');
if (caddy.includes('{$CMS_URL}')) ok('Caddy слушает домен админки');
else fail('в Caddyfile нет {$CMS_URL}');

/* ─── 5. Порты в compose ─── */

if (/127\.0\.0\.1:1337:1337/.test(raw)) ok('админка CMS слушает только localhost (защищена от внешнего доступа)');
else fail('порт 1337 должен быть ограничен 127.0.0.1');

if (/'80:80'/.test(raw) && /'443:443'/.test(raw)) ok('Caddy слушает 80 и 443');
else fail('не проброшены порты 80/443');

console.log(bad === 0 ? '\n✓ Конфигурация деплоя согласована.' : `\n✗ Замечаний: ${bad}`);
process.exit(bad === 0 ? 0 : 1);
