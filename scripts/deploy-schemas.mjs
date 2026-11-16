/**
 * Развёртывание content-type схем в проект Strapi.
 *
 *   node scripts/deploy-schemas.mjs
 *
 * Структура по правилам Strapi 5:
 *   src/api/<singularName>/content-types/<singularName>/schema.json
 *   src/api/<singularName>/controllers/<singularName>.ts
 *   src/api/<singularName>/routes/<singularName>.ts
 *   src/api/<singularName>/services/<singularName>.ts
 *
 * Требования Strapi, которые важно соблюсти:
 *   1) имя папки content-type == info.singularName;
 *   2) все singularName и pluralName должны быть уникальны
 *      в общем списке (плоский набор, без различения singular/plural).
 *
 * Идемпотентно: существующие схемы перезаписываются.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SCHEMAS_DIR = path.join(ROOT, 'cms', 'schemas');
const API_DIR = path.join(ROOT, 'cms-admin', 'src', 'api');

const controller = (uid) =>
  `import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::${uid}.${uid}');
`;

const route = (uid) =>
  `import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::${uid}.${uid}');
`;

const service = (uid) =>
  `import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::${uid}.${uid}');
`;

(async () => {
  const files = (await fs.readdir(SCHEMAS_DIR)).filter((f) => f.endsWith('.json'));
  console.log(`Схем: ${files.length}\n`);

  const seen = new Set();

  for (const file of files) {
    /* PowerShell может дописать BOM — JSON.parse его не терпит */
    const raw = await fs.readFile(path.join(SCHEMAS_DIR, file), 'utf8');
    const schema = JSON.parse(raw.replace(/^﻿/, ''));

    const uid = schema.info.singularName;
    const plural = schema.info.pluralName;

    /* Проверка уникальности — ровно как в Strapi */
    for (const n of [uid, plural]) {
      if (seen.has(n)) {
        console.error(`  ! Имя «${n}» уже использовано — переименуйте singular/plural`);
        process.exit(1);
      }
      seen.add(n);
    }

    const base = path.join(API_DIR, uid);
    await fs.mkdir(path.join(base, 'content-types', uid), { recursive: true });
    await fs.mkdir(path.join(base, 'controllers'), { recursive: true });
    await fs.mkdir(path.join(base, 'routes'), { recursive: true });
    await fs.mkdir(path.join(base, 'services'), { recursive: true });

    await fs.writeFile(
      path.join(base, 'content-types', uid, 'schema.json'),
      JSON.stringify(schema, null, 2),
      'utf8'
    );
    await fs.writeFile(path.join(base, 'controllers', `${uid}.ts`), controller(uid), 'utf8');
    await fs.writeFile(path.join(base, 'routes', `${uid}.ts`), route(uid), 'utf8');
    await fs.writeFile(path.join(base, 'services', `${uid}.ts`), service(uid), 'utf8');

    console.log(`  api::${uid}  →  ${schema.info?.displayName ?? uid}  (REST: /api/${plural})`);
  }

  /* Чистим старые папки, оставшиеся от прошлых раскладок */
  for (const dir of await fs.readdir(API_DIR)) {
    if (dir === '.gitkeep') continue;
    if (!seen.has(dir)) {
      await fs.rm(path.join(API_DIR, dir), { recursive: true, force: true });
      console.log(`  удалена устаревшая папка: ${dir}`);
    }
  }

  console.log('\nГотово. Перезапустите Strapi, чтобы схемы подхватились.');
})();
