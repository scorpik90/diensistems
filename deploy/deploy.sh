#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  Деплой genorg.ru: сайт (Next.js) + CMS (Strapi) + PostgreSQL
#
#  Скрипт идемпотентный — его можно запускать повторно:
#  каждый шаг либо выполняется, либо пропускается, если уже сделано.
#
#  Запуск на сервере:
#     git clone <репозиторий> /opt/genorg && cd /opt/genorg
#     ./deploy/deploy.sh
#
#  Что делает:
#     1. проверяет Docker и свободные порты;
#     2. создаёт .env с секретами (если нет) и .env.production;
#     3. поднимает PostgreSQL и Strapi;
#     4. ждёт готовности CMS и импортирует данные из content/seed.json;
#     5. собирает и запускает сайт;
#     6. поднимает Caddy — TLS-сертификат выпускается сам;
#     7. создаёт учётные записи менеджеров в CMS;
#     8. настраивает ежедневные бэкапы.
#
#  Что остаётся сделать руками (автоматизировать нельзя):
#     • оплатить сервер и получить IP;
#     • прописать A-запись домена на этот IP;
#     • залить сюда код;
#     • один раз выполнить ./deploy/deploy.sh.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'; NC='\033[0m'

step()  { echo -e "\n${BLUE}▶ $*${NC}"; }
ok()    { echo -e "  ${GREEN}✓${NC} $*"; }
warn()  { echo -e "  ${YELLOW}!${NC} $*"; }
fail()  { echo -e "  ${RED}✗${NC} $*"; exit 1; }

# ─── 1. Проверки окружения ────────────────────────────────────

step "Проверяю окружение"

command -v docker >/dev/null 2>&1 || fail "Не найден Docker. Установите Docker Engine + Compose plugin."

docker compose version >/dev/null 2>&1 || fail "Не найден docker compose (плагин)."

docker info >/dev/null 2>&1 || fail "Docker не отвечает. Проверьте: systemctl status docker"

ok "Docker $(docker version --format '{{.Server.Version}}'), Compose $(docker compose version --short)"

for port in 80 443; do
  if (command -v ss >/dev/null 2>&1 && ss -tln "sport = :$port" 2>/dev/null | grep -q LISTEN) ||
     (command -v netstat >/dev/null 2>&1 && netstat -tln 2>/dev/null | grep -q ":$port ") ||
     (command -v lsof >/dev/null 2>&1 && lsof -i :$port >/dev/null 2>&1); then
    warn "Порт $port занят — Caddy не сможет получить сертификат. Остановите nginx/apache."
  fi
done

# ─── 2. Конфигурация и секреты ───────────────────────────────

step "Готовлю конфигурацию"

ENV_FILE=".env"
ENV_PROD=".env.production"

if [ ! -f "$ENV_FILE" ]; then
  echo "  .env не найден — создаю со случайными секретами"

  # Секреты генерируем без Node и OpenSSL — только ядро Linux
  gen() { head -c 48 /dev/urandom | base64 | tr -d '=+/' | head -c 43; }

  cat > "$ENV_FILE" <<EOF
# Сгенерировано автоматически: deploy.sh
# Правьте вручную только значения ниже.

# Публичный адрес сайта (без https://)
SITE_URL=genorg.ru
# Адрес админки CMS
CMS_URL=cms.genorg.ru
# Публичный адрес CMS — от него строятся ссылки на фотографии в вёрстке
CMS_PUBLIC_URL=https://cms.genorg.ru

# База данных
POSTGRES_USER=genorg
POSTGRES_PASSWORD=$(gen)
POSTGRES_DB=genorg

# Секреты Strapi (менять не нужно)
APP_KEYS=$(gen),$(gen),$(gen),$(gen)
API_TOKEN_SALT=$(gen)
ADMIN_JWT_SECRET=$(gen)
TRANSFER_TOKEN_SALT=$(gen)
JWT_SECRET=$(gen)
ENCRYPTION_KEY=$(gen)
STRAPI_ADMIN_JWT_SECRET=$(gen)

# Токен API для чтения данных сайтом
STRAPI_TOKEN=$(gen)
# Токен API для записи — им сайт сохраняет заявки в CMS
STRAPI_WRITE_TOKEN=$(gen)
EOF

  ok "Создан .env со случайными секретами"
else
  ok ".env уже есть — использую его"
fi

# Собираем .env.production из .env + .env.local
if [ -f ".env.local" ]; then
  cat ".env" ".env.local" > "$ENV_PROD"
else
  cp ".env" "$ENV_PROD"
fi
ok "Готов $ENV_PROD"

# Токен из локальной разработки, если он есть и совпадает с CMS
if [ -f ".strapi-tokens.json" ] && command -v node >/dev/null 2>&1; then
  LOCAL_TOKEN=$(node -e "try{console.log(require('./.strapi-tokens.json')['genorg-read']||'')}catch(e){console.log('')}")
  if [ -n "$LOCAL_TOKEN" ]; then
    warn "Найден локальный токен API. Если CMS на сервере уже содержит данные — оставьте токен из .env, иначе замените на значение из блока «API Tokens» в админке."
  fi
fi

# ─── 3. PostgreSQL ───────────────────────────────────────────

step "Поднимаю PostgreSQL"

docker compose up -d db

for i in $(seq 1 30); do
  if docker compose exec -T db pg_isready -U "$(grep '^POSTGRES_USER=' "$ENV_FILE" | cut -d= -f2)" >/dev/null 2>&1; then
    ok "База данных готова"
    break
  fi
  [ "$i" -eq 30 ] && fail "База данных не поднялась за 5 минут"
  sleep 10
done

# ─── 4. Strapi ────────────────────────────────────────────────

step "Собираю и запускаю CMS (Strapi)"

docker compose build strapi
docker compose up -d strapi

echo "  жду готовности CMS (сборка админки может занять 3–5 минут)…"
for i in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:1337/_health" >/dev/null 2>&1 ||
     curl -fsS "http://127.0.0.1:1337/admin" >/dev/null 2>&1; then
    ok "CMS отвечает"
    break
  fi
  [ "$i" -eq 60 ] && fail "CMS не поднялась за 10 минут. Смотрите логи: docker compose logs strapi"
  sleep 10
done

# ─── 5. Импорт данных ────────────────────────────────────────

step "Импортирую данные в CMS"

if docker compose exec -T strapi node scripts/import-to-strapi.mjs --reset; then
  ok "Данные импортированы (47 позиций, 9 кейсов, 14 страниц, отзывы)"
else
  warn "Импорт не завершился — проверьте логи и повторите позже"
fi

# Текстовые блоки, меню и фотографии — отдельным шагом:
# они лежат в медиатеке Strapi, а не в базе.
if docker compose exec -T strapi node scripts/import-content-to-cms.mjs; then
  ok "Тексты, меню и фотографии загружены в медиатеку CMS"
else
  warn "Перенос контента не завершился — проверьте логи"
fi

# ─── 6. Сайт ─────────────────────────────────────────────────

step "Собираю и запускаю сайт (Next.js)"

# Токен сборки — как BuildKit secret: в слои образа и в его историю
# он не попадает (в отличие от ARG).
mkdir -p secrets
chmod 700 secrets
if [ -s secrets/strapi_token.txt ]; then
  ok "Секрет сборки записан в secrets/strapi_token.txt"
else
  STRAPI_TOKEN_BUILD=$(grep '^STRAPI_TOKEN=' "$ENV_FILE" | cut -d= -f2)
  if [ -n "$STRAPI_TOKEN_BUILD" ]; then
    printf '%s' "$STRAPI_TOKEN_BUILD" > secrets/strapi_token.txt
    chmod 600 secrets/strapi_token.txt
    ok "Секрет сборки создан из .env"
  else
    warn "В .env нет STRAPI_TOKEN — сборка сайта падёт на обращении к CMS"
  fi
fi

# Каталог резервных заявок должен существовать ДО старта контейнера:
# Docker создал бы его от root, а пишет в него пользователь nextjs (uid 1001)
mkdir -p data
chown 1001:1001 data 2>/dev/null || true

echo "  очищаю кэш предыдущей сборки (чтобы не остались старые страницы)…"
docker compose exec -T web rm -rf /app/.next 2>/dev/null || true
rm -rf .next

echo "  сборка образа занимает 2–4 минуты…"
docker compose build web
docker compose up -d web

echo "  жду готовности сайта…"
for i in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:3000/" >/dev/null 2>&1; then
    ok "Сайт отвечает"
    break
  fi
  [ "$i" -eq 30 ] && fail "Сайт не поднялся за 5 минут. Логи: docker compose logs web"
  sleep 10
done

# ─── 7. Caddy и сертификат ───────────────────────────────────

step "Поднимаю Caddy (reverse proxy + SSL)"

docker compose up -d caddy

SITE=$(grep '^SITE_URL=' "$ENV_FILE" | cut -d= -f2)

echo "  проверяю сертификат (Let's Encrypt)…"
for i in $(seq 1 24); do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' "https://$SITE/" 2>/dev/null || echo 000)
  if [ "$CODE" = "200" ]; then
    ok "Сертификат выпущен, сайт отвечает по HTTPS"
    break
  fi
  [ "$i" -eq 24 ] && warn "Сертификат пока не выпущен. Проверьте: A-запись домена указывает на $(curl -s ifconfig.me || echo 'IP сервера')?"
  sleep 15
done

# ─── 8. Учётные записи менеджеров ─────────────────────────────

step "Создаю учётные записи менеджеров в CMS"

if docker compose exec -T strapi node scripts/create-managers.mjs; then
  ok "Менеджеры созданы (логины и пароли — в выводе выше)"
else
  warn "Не удалось создать менеджеров — сделайте это вручную в админке"
fi

# ─── 9. Бэкапы ───────────────────────────────────────────────

step "Настраиваю ежедневные бэкапы"

mkdir -p /opt/genorg-backups

cat > /opt/genorg-backups/backup.sh <<'BACKUP'
#!/usr/bin/env bash
# Дамп базы + загруженные файлы, ротация 14 копий
set -euo pipefail
cd /opt/genorg
STAMP=$(date +%F-%H%M)
mkdir -p /opt/genorg-backups
docker compose exec -T db pg_dump -U "${POSTGRES_USER:-genorg}" "${POSTGRES_DB:-genorg}" \
  | gzip > "/opt/genorg-backups/db-$STAMP.sql.gz"
docker run --rm -v genorg_strapi-uploads:/u:ro -v /opt/genorg-backups:/out \
  alpine tar czf "/out/uploads-$STAMP.tar.gz" -C /u .
# Резервные заявки (data/) тоже в бэкап.
# Резервный канал заявок содержит персональные данные (имя, телефон) —
# в бэкап он входит, поэтому файл-канал в проде инструмент крайне
# редкого случая.
if [ -d data ]; then
  tar czf "/opt/genorg-backups/data-$STAMP.tar.gz" data
fi
find /opt/genorg-backups -type f -mtime +14 -delete
BACKUP

chmod +x /opt/genorg-backups/backup.sh

# Ссылка на переменные окружения
cat > /opt/genorg-backups/.env <<ENVFILE
$(grep -E '^(POSTGRES_USER|POSTGRES_DB)=' "$ROOT/$ENV_FILE")
ENVFILE

cat > /etc/cron.d/genorg-backup <<CRON
# Бэкап сайта и CMS — каждый день в 4:17
17 4 * * * root /opt/genorg-backups/backup.sh >> /opt/genorg-backups/backup.log 2>&1
CRON
chmod 644 /etc/cron.d/genorg-backup

ok "Бэкапы: /opt/genorg-backups, расписание — каждый день в 04:17"

# ─── Итог ────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Деплой завершён${NC}"
echo -e "${GREEN}════════════════════════════════════════════${NC}"
echo ""
echo "  Сайт:        https://$SITE/"
CMS_HOST=$(grep '^CMS_URL=' "$ENV_FILE" | cut -d= -f2)
echo "  Админка CMS: https://$CMS_HOST/admin  (логин и пароль — в выводе шага 8)"
echo ""
echo "  Что дальше:"
echo "   • зайти на https://$CMS_HOST/admin и сменить пароли;"
echo "   • проверить форму заявки (заявка появляется в админке CMS → «Заявки»;"
echo "     письма уходят через цепочку боевого сайта, пока он жив);"
echo "   • если нужна почта для форм — подключить SMTP (Mail.ru, Яндекс.360);"
echo "   • добавить сайт в Яндекс.Вебмастер и Яндекс.Карты."
echo ""
echo "  Полезные команды:"
echo "   docker compose ps                 — состояние сервисов"
echo "   docker compose logs -f web        — логи сайта"
echo "   docker compose logs -f strapi     — логи CMS"
echo "   ./deploy/deploy.sh                — повторный деплой (идемпотентно)"
echo ""
