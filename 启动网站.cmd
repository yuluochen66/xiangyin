@echo off
setlocal
cd /d "%~dp0"

echo ==================================================
echo    Xiangyin Youju  -  local preview
echo ==================================================
echo.

rem Resolve a package runner, in order of preference:
rem   1. pnpm on PATH
rem   2. node on PATH + XIANGYIN_PNPM pointing at pnpm.cjs
rem No absolute machine paths are hard-coded on purpose: this file is public.
rem See README section "Local preview" for details.
set "RUNNER="
where pnpm >nul 2>nul
if not errorlevel 1 set "RUNNER=pnpm"
if not defined RUNNER (
  where node >nul 2>nul
  if not errorlevel 1 if defined XIANGYIN_PNPM set "RUNNER=node "%XIANGYIN_PNPM%""
)
if not defined RUNNER (
  echo [ERROR] Cannot find pnpm, nor node + XIANGYIN_PNPM, on PATH.
  echo.
  echo   Option A: install Node.js 22 or newer ^(npm included^), then run:
  echo               npm install -g pnpm
  echo   Option B: point this script at an existing pnpm.cjs:
  echo               set XIANGYIN_PNPM=C:\path\to\pnpm.cjs
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\vue" (
  echo First run: installing dependencies, this may take a while...
  call %RUNNER% install
)

echo Starting the local server...
echo.
echo    Open this URL in your browser:
echo.
echo        http://localhost:5174/
echo.
echo    Keep this window open while you use the site.
echo    Press Ctrl+C to stop the server.
echo.

rem Wait 6s before opening the browser so the server is ready.
start "opening-browser" /min cmd /c "ping -n 6 127.0.0.1 >nul & explorer http://localhost:5174/"

call %RUNNER% dev --port 5174 --strictPort

echo.
echo Server stopped.
pause
