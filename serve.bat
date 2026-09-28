@echo off
title Lister Rodriguez Portfolio - Local Server
cd /d "%~dp0"
echo Starting preview server...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
pause
