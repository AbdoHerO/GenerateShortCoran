@echo off
rem Double-click to start Quran Video Studio. It opens in your browser; keep this window open while you work.
cd /d "%~dp0"
title Quran Video Studio
where node >nul 2>nul || (echo Node.js is not installed. Install it from https://nodejs.org and try again. & pause & exit /b 1)
if not exist ".venv\Scripts\python.exe" (echo The Python environment .venv is missing. See docs\STUDIO.md, "First-time setup". & pause & exit /b 1)
node platform\server.mjs --open
pause
