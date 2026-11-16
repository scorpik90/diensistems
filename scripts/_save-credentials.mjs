import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const tokens = JSON.parse(fs.readFileSync(path.join(ROOT, '.strapi-tokens.json'), 'utf8'));

/**
 * Пароли админки берём из окружения, а не из кода:
 * в репозитории их быть не должно.
 */
function envPassword(name) {
  return (
    process.env[name] ??
    (() => {
      try {
        const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
        const m = env.match(new RegExp(`^${name}=(.*)$`, 'm'));
        return m ? m[1].trim() : '';
      } catch {
        return '';
      }
    })()
  );
}

const adminPass = envPassword('ADMIN_PASSWORD');
const editorPass = envPassword('EDITOR_PASSWORD');
const authorPass = envPassword('AUTHOR_PASSWORD');

const desktop = path.join(os.homedir(), 'OneDrive', 'Desktop');
const dir = fs.existsSync(desktop) ? desktop : path.join(os.homedir(), 'Desktop');
const file = path.join(dir, 'ДИЭН-Системс — доступы к CMS.txt');

const content = `════════════════════════════════════════════════════════════
  ДИЭН-Системс — доступы к CMS (Strapi)
  Сайт: https://genorg.ru
  Админка CMS: http://127.0.0.1:1337/admin  (на сервере: https://cms.genorg.ru/admin)
  Файл создан: ${new Date().toLocaleString('ru-RU')}
════════════════════════════════════════════════════════════

УЧЁТНЫЕ ЗАПИСИ АДМИНКИ
────────────────────────────────────────────────────────────────────

1) Super Admin — полный доступ
   Логин:  admin@genorg.ru
   Пароль: ${adminPass}

2) Editor — редактор контента
   Логин:  editor@genorg.ru
   Пароль: ${editorPass}

3) Author — автор статей
   Логин:  author@genorg.ru
   Пароль: ${authorPass}


API-ТОКЕНЫ (для скриптов и деплоя)
────────────────────────────────────────────────────────────────────

Read-only (сайт читает данные каталога):
   ${tokens['genorg-read']}

Full access (импорт данных, скрипты):
   ${tokens['genorg-write']}

Где лежат: variant-c/.strapi-tokens.json и variant-c/.env
   (в .gitignore — в репозиторий не попадают)


ПОЛЕЗНОЕ
────────────────────────────────────────────────────────────────────

Адрес базы техники: 141400, Московская обл., г. Химки,
Ленинградское шоссе, 360Б
Телефон:  +7 (495) 540-52-92
E-mail:   diensystem@mail.ru

Локальный запуск (сайт + CMS):
   cd "D:\\scorp\\Cloude\\Диэн new\\variant-c"
   .\\scripts\\start-all.ps1

Деплой на сервер:
   ./deploy/deploy.sh   (подробности — deploy/README.md)

Заявки с сайта: видно в админке → Content Manager → Заявки,
а также приходят письмом на diensystem@mail.ru (пока работает боевой сайт).


════════════════════════════════════════════════════════════
  ВАЖНО: в этом файле — пароли и токены доступа к CMS.
  Не пересылайте его в почте и не выкладывайте в репозиторий.
  После размещения сайта в интернете смените пароли
  в админке (Администрирование → Пользователи).
════════════════════════════════════════════════════════════
`;

fs.writeFileSync(file, content, 'utf8');
console.log('  ✓ ' + file);
console.log('  размер: ' + Math.round(content.length / 1024) + ' КБ');
