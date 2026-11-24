@echo off
title Smart Campus Vision - System Launcher
echo ===================================================
echo             SMART CAMPUS VISION
echo ===================================================
echo.
echo 1. Starting FastAPI Backend (Port 8000)...
start "Smart Campus Backend" cmd /k "cd /d %~dp0backend && .venv\Scripts\python.exe run.py"

echo 2. Starting Next.js Web Frontend (Port 3000)...
start "Smart Campus Frontend" cmd /k "cd /d %~dp0smart-campus-web && npm run dev"

echo.
echo Both servers are launching!
echo Backend:  http://127.0.0.1:8000 (API & Docs)
echo Frontend: http://localhost:3000 (Web App)
echo.
echo You can now open your browser at http://localhost:3000
