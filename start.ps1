Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "             SMART CAMPUS VISION                   " -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Starting FastAPI Backend on Port 8000..." -ForegroundColor Yellow
Start-Process -FilePath "cmd.exe" -ArgumentList "/k", "cd /d `"$PSScriptRoot\backend`" && .venv\Scripts\python.exe run.py"

Write-Host "2. Starting Next.js Web Frontend on Port 3000..." -ForegroundColor Yellow
Start-Process -FilePath "cmd.exe" -ArgumentList "/k", "cd /d `"$PSScriptRoot\smart-campus-web`" && npm run dev"

Write-Host ""
Write-Host "Both servers are launching in separate windows!" -ForegroundColor Green
Write-Host "Backend API:  http://127.0.0.1:8000" -ForegroundColor Cyan
Write-Host "Web Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
