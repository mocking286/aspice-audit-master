@echo off
setlocal
cd /d "%~dp0"
set "CODEX_INPUT_PATH=%~1"
if "%CODEX_INPUT_PATH%"=="" set "CODEX_INPUT_PATH=%ASPICE_CODEX_PATH%"

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-RestMethod -Uri 'http://127.0.0.1:8787/health' -TimeoutSec 1 | Out-Null; exit 0 } catch { exit 1 }"
if errorlevel 1 (
  if "%CODEX_INPUT_PATH%"=="" (
    start "ASPICE Codex Bridge" powershell.exe -NoExit -NoProfile -ExecutionPolicy Bypass -File "%~dp0aspice-codex-bridge.ps1"
  ) else (
    start "ASPICE Codex Bridge" powershell.exe -NoExit -NoProfile -ExecutionPolicy Bypass -File "%~dp0aspice-codex-bridge.ps1" -CodexPath "%CODEX_INPUT_PATH%" -CodexConfigPath "%CODEX_INPUT_PATH%" -Workspace "%~dp0"
  )
  timeout /t 2 /nobreak >nul
)

start "" "%~dp0aspice-audit-master.html"
