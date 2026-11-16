# ══════════════════════════════════════════════════════════════════════
#  Остановка стенда C1
#    powershell -ExecutionPolicy Bypass -File scripts/stop-all.ps1
# ══════════════════════════════════════════════════════════════════════

$ErrorActionPreference = 'Continue'

Write-Host "`n═══ Остановка стенда C1 ═══`n" -ForegroundColor Cyan

# Останавливаем по процессам, а не по портам — порты могли бы переиспользоваться
$patterns = @('strapi', 'next\\dist\\bin', 'audit\\serve.js')

foreach ($pat in $patterns) {
  $procs = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match $pat -and $_.CommandLine -notmatch 'start-all' }
  foreach ($p in $procs) {
    Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
    Write-Host "  ✓ остановлен PID $($p.ProcessId)" -ForegroundColor DarkGray
  }
}

foreach ($port in @(1337, 3100, 8099)) {
  $c = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  if ($c) {
    foreach ($x in $c) { Stop-Process -Id $x.OwningProcess -Force -ErrorAction SilentlyContinue }
    Write-Host "  ✓ освобождён порт $port" -ForegroundColor DarkGray
  }
}

Write-Host "`n  Остановлено.`n" -ForegroundColor Cyan
