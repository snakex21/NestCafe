@echo off
setlocal
set "ROOT=%~dp0"

REM Buduje swiezy NestCafe i tworzy czysty pakiet portable w dist\.
REM Do pakietu nie sa kopiowane klucze, sesje, historia ani inne dane lokalne.

powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%scripts\build-portable.ps1" %*

set "CODE=%ERRORLEVEL%"
if not "%CODE%"=="0" (
  echo.
  echo Budowanie wersji portable nie powiodlo sie.
  pause
)
exit /b %CODE%
