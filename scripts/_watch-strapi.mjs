// Сторож Strapi: в режиме develop он периодически падает (особенность
// окружения). Скрипт поднимает его заново и держит живым.
//   node scripts/_watch-strapi.mjs
//
// Остановить: Ctrl+C

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CMS = path.resolve(__dirname, '..', 'cms-admin');
const URL = process.env.STRAPI_URL ?? 'http://127.0.0.1:1337';

let child = null;
let stopping = false;

function start() {
  child = spawn(
    process.execPath,
    [path.join('node_modules', '@strapi', 'strapi', 'bin', 'strapi.js'), 'develop'],
    { cwd: CMS, stdio: 'ignore', windowsHide: true }
  );
  child.on('exit', (code) => {
    child = null;
    if (stopping) return;
    console.log(`[watch] Strapi завершился (код ${code}) — перезапускаю через 5 с`);
    setTimeout(() => !stopping && start(), 5000);
  });
}

async function waitUp(timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${URL}/admin`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) return true;
    } catch {
      /* ещё не поднялся */
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return false;
}

console.log('[watch] запускаю Strapi');
start();
if (await waitUp()) console.log('[watch] CMS отвечает');

setInterval(async () => {
  if (stopping) return;
  try {
    const res = await fetch(`${URL}/admin`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(String(res.status));
  } catch {
    console.log('[watch] CMS не отвечает — перезапускаю');
    try {
      child?.kill();
    } catch {
      /* уже умер */
    }
    child = null;
    setTimeout(() => !stopping && start(), 3000);
  }
}, 30000);

process.on('SIGINT', () => {
  stopping = true;
  child?.kill();
  process.exit(0);
});
