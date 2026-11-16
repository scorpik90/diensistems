/**
 * Проверка репозитория перед отправкой в GitHub.
 *
 *   node scripts/_check-secrets.mjs
 *
 * Ищет в отслеживаемых файлах:
 *   1) файлы с секретами, которые не должны попасть в репозиторий;
 *   2) типичные секреты в тексте (токены, пароли, ключи);
 *   3) мусор (логи, кэш, сборка).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const GIT = 'C:\\Program Files\\Git\\cmd\\git.exe';
const ROOT = process.cwd();

const git = (...args) =>
  execFileSync(GIT, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();

const problems = [];

console.log('════════ Проверка перед пушем ════════\n');

/* ── 1. Файлы с секретами не должны быть отслеживаемыми ── */
const tracked = git('ls-files').split('\n').filter(Boolean);
console.log(`  отслеживаемых файлов: ${tracked.length}`);

const FORBIDDEN = [
  /^\.env$/,
  /\.env$/,
  /^\.strapi-tokens\.json$/,
  /^secrets\//,
  /^\.next\//,
  /node_modules\//,
  /\.log$/,
  /\.err$/,
  /^data\//,
  /^\.tmp\//,
  /uploads\//,
  /^_cache\//,
  /^scripts\/_cache\//,
  /tsconfig\.tsbuildinfo$/,
];

for (const f of tracked) {
  if (FORBIDDEN.some((re) => re.test(f))) problems.push(`отслеживается файл с секретом/мусором: ${f}`);
}

/* ── 2. Секреты в тексте ── */
const PATTERNS = [
  { re: /Genorg-(Admin|Editor|Author)-2026!/, name: 'пароль админки Strapi' },
  { re: /\bGenorg-[A-Za-z]+-2026!/, name: 'пароль админки Strapi' },
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, name: 'приватный ключ' },
  { re: /ghp_[A-Za-z0-9]{36}/, name: 'GitHub-токен' },
  { re: /github_pat_[A-Za-z0-9_]{50,}/, name: 'GitHub-токен (fine-grained)' },
  { re: /\bsk-[A-Za-z0-9]{32,}/, name: 'ключ API' },
  { re: /AKIA[0-9A-Z]{16}/, name: 'AWS-ключ' },
  { re: /postgresql:\/\/[^:\s]+:[^@\s]+@/, name: 'пароль в строке подключения' },
];

let scanned = 0;
for (const f of tracked) {
  /* Бинарные и большие файлы не читаем */
  let st;
  try {
    st = fs.statSync(`${ROOT}/${f}`);
  } catch {
    continue;
  }
  if (!st.isFile() || st.size > 3 * 1024 * 1024) continue;
  if (/\.(png|jpe?g|gif|webp|avif|ico|woff2?|pdf|zip|gz)$/i.test(f)) continue;

  let text;
  try {
    text = fs.readFileSync(`${ROOT}/${f}`, 'utf8');
  } catch {
    continue;
  }
  scanned++;
  for (const p of PATTERNS) {
    if (p.re.test(text)) problems.push(`${f}: похоже на ${p.name}`);
  }
}
console.log(`  просканировано текстовых файлов: ${scanned}`);

/* ── 3. Токены Strapi из .env ── */
if (fs.existsSync(`${ROOT}/.strapi-tokens.json`)) {
  const tokens = JSON.parse(fs.readFileSync(`${ROOT}/.strapi-tokens.json`, 'utf8'));
  for (const value of Object.values(tokens)) {
    if (typeof value !== 'string' || value.length < 40) continue;
    for (const f of tracked) {
      if (/\.(png|jpe?g|gif|webp|avif|ico|woff2?|pdf|zip|gz)$/i.test(f)) continue;
      let text;
      try {
        text = fs.readFileSync(`${ROOT}/${f}`, 'utf8');
      } catch {
        continue;
      }
      if (text.includes(value)) problems.push(`${f}: содержит действующий API-токен Strapi`);
    }
  }
  console.log('  API-токены Strapi проверены');
}

console.log('');
if (problems.length) {
  console.log(`✗ проблем: ${problems.length}`);
  for (const p of problems.slice(0, 30)) console.log(`   · ${p}`);
  process.exit(1);
}
console.log('✓ секретов и мусора в индексе нет');
