# first_time_setup.ps1
# Run once from the berlinjobhunt\ project root in PowerShell:
#   cd C:\Users\mayan\Documents\Claude\Projects\berlinjobhunt
#   .\tools\first_time_setup.ps1

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot | Split-Path

Write-Host ""
Write-Host "=== Berlin Job Hub - First Time Setup ===" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Backend virtualenv + install ──────────────────────────────────────
Write-Host "[1/5] Installing backend Python dependencies..." -ForegroundColor Yellow
Set-Location "$Root\backend"
if (-not (Test-Path ".venv")) {
    python -m venv .venv
}
& .\.venv\Scripts\pip install -r requirements.txt -q
Write-Host "      Done." -ForegroundColor Green

# ── Step 2: Django system check ───────────────────────────────────────────────
Write-Host ""
Write-Host "[2/5] Running Django system check against Supabase..." -ForegroundColor Yellow
& .\.venv\Scripts\python manage.py check --database default
Write-Host "      Django check passed." -ForegroundColor Green

# ── Step 3: Crawler deps + Playwright ─────────────────────────────────────────
Write-Host ""
Write-Host "[3/5] Installing crawler dependencies (this may take a few minutes)..." -ForegroundColor Yellow
Set-Location "$Root\crawler"
if (-not (Test-Path ".venv")) {
    python -m venv .venv
}
& .\.venv\Scripts\pip install -r requirements.txt -q
Write-Host "      Installing Crawl4AI browser (Chromium via Playwright)..."
& .\.venv\Scripts\crawl4ai-setup
Write-Host "      Done." -ForegroundColor Green

# ── Step 4: First crawl (dry-run to see extraction JSON) ─────────────────────
Write-Host ""
Write-Host "[4/5] Dry-run crawl of Zalando job posting..." -ForegroundColor Yellow
Write-Host "      (crawls page + calls DeepSeek, does NOT write to DB)" -ForegroundColor DarkGray
& .\.venv\Scripts\python main.py `
    --url "https://jobs.zalando.com/en/jobs/4206536-senior-software-engineer-backend-zalando-direct/" `
    --company "Zalando SE" `
    --homepage "https://www.zalando.de" `
    --city Berlin `
    --size Enterprise `
    --dry-run

# ── Step 5: Frontend ──────────────────────────────────────────────────────────
Write-Host ""
Write-Host "[5/5] Installing frontend dependencies..." -ForegroundColor Yellow
Set-Location "$Root\frontend"
npm install
Write-Host ""
Write-Host "=== Setup complete! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Run supabase/init.sql in your Supabase SQL editor (if not done yet)"
Write-Host "  2. Start Django:   cd backend && .venv\Scripts\python manage.py runserver"
Write-Host "  3. Start frontend: cd frontend && npm run dev"
Write-Host "  4. Full crawl:     cd crawler && .venv\Scripts\python main.py --url <url> --company ... --homepage ..."
Write-Host ""
