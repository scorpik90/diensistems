# ══════════════════════════════════════════════════════════════════════
#  Запуск стенда варианта C1: Strapi (CMS) + Next.js (сайт)
#
#    powershell -ExecutionPolicy Bypass -File scripts/start-all.ps1
#
#  Что поднимает:
#    :1337  Strapi — админка контента (CMS)
#    :3100  Next.js — сайт (Next 15 + App Router + SSG/ISR)
#    :8099  статика (вариант B, аудит, отчёты)
#
#  Запуск в фоне, логи пишутся рядом.
# ══════════════════════════════════════════════════════════════════════

$ErrorActionPreference = 'Continue'
$ROOT = Split-Path -Parent $PSScriptRoot
$ROOT = Split-Path -Parent $ROOT

function Port([int]$p) {
  $c = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
  if ($c) { return $true }
  return $false
}

function Wait([int]$p, [string]$label, [int]$max = 30) {
  for ($i = 1; $i -le $max; $i++) {
    Start-Sleep -Seconds 2
    try {
      $r = Invoke-WebRequest -Uri "http://127.0.0.1:$p/admin" -UseBasicParsing -TimeoutSec 4
      if ($r.StatusCode -eq 200) { Write-Host "  ✓ $label отвечает на :$p" -ForegroundColor Green; return $true }
    } catch { }
  }
  Write-Host "  ✗ $label не поднялся на :$p" -ForegroundColor Red
  return $false
}

Write-Host "`n═══ Запуск стенда C1 ═══`n" -ForegroundColor Cyan

# ── 1. Strapi ────────────────────────────────────────────────────────
if (Port 1337) {
  Write-Host "  = Strapi уже работает на :1337" -ForegroundColor DarkGray
} else {
  Write-Host "  → Strapi…"
  $env:HOST = '0.0.0.0'; $env:PORT = '1337'
  Start-Process -FilePath 'node' `
    -ArgumentList 'node_modules\@strapi\strapi\bin\strapi.js', 'develop' `
    -WorkingDirectory "$ROOT\cms-admin" -WindowStyle Hidden `
    -RedirectStandardOutput "$ROOT\strapi.log" -RedirectStandardError "$ROOT\strapi.err" | Out-Null
  Wait 1337 'Strapi'
}

# ── 2. Next.js ───────────────────────────────────────────────────────
if (Port 3100) {
  Write-Host "  = Next.js уже работает на :3100" -ForegroundColor DarkGray
} else {
  Write-Host "  → Next.js…"
  $env:PORT = '3100'; $env:NODE_ENV = 'production'
  Start-Process -FilePath 'node' `
    -ArgumentList 'node_modules\next\dist\bin\next', 'start', '-p', '3100' `
    -WorkingDirectory $ROOT -WindowStyle Hidden `
    -RedirectStandardOutput "$ROOT\server.log" -RedirectStandardError "$ROOT\server.err" | Out-Null
  Wait 3100 'Next.js'
}

# ── 3. Статика (вариант B) ───────────────────────────────────────────
if (Port 8099) {
  Write-Host "  = статика уже работает на :8099" -ForegroundColor DarkGray
} else {
  Write-Host "  → статика…"
  $env:SERVE_ROOT = $ROOT; $env:SERVE_PORT = '8099'
  Start-Process -FilePath 'node' -ArgumentList 'serve.js' `
    -WorkingDirectory "$ROOT\audit" -WindowStyle Hidden `
    -RedirectStandardOutput "$ROOT\audit\server.log" -RedirectStandardError "$ROOT\audit\server.err" | Out-Null
  Start-Sleep -Seconds 2
  Write-Host "  ✓ статика на :8099" -ForegroundColor Green
}

Write-Host "`n═══ Готово ═══" -ForegroundColor Cyan
Write-Host "  Сайт (C1)        http://127.0.0.1:3100/"
Write-Host "  Админка CMS      http://127.0.0.1:1337/admin"
Write-Host "  Локальный /admin http://127.0.0.1:3100/admin"
Write-Host "  Вариант B        http://127.0.0.1:8099/prototype/index.html"
Write-Host "  Отчёт            http://127.0.0.1:8099/audit/AUDIT.md`n"
