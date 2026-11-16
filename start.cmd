@echo off
cd /d "%~dp0"
set "ATLAS_NODE=node.exe"
where.exe node.exe >nul 2>nul
if errorlevel 1 (
    if exist "%ProgramFiles%\nodejs\node.exe" (
        set "ATLAS_NODE=%ProgramFiles%\nodejs\node.exe"
    ) else (
        echo Node.js 22 or later is required. Install Node.js and try again.
        pause
        exit /b 1
    )
)
"%ATLAS_NODE%" server.mjs
pause
