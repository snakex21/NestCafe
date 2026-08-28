@echo off
setlocal
set "ROOT=%~dp0"

REM build.bat              - buduje NestCafe.exe (launcher + native-ui)
REM build.bat C:\path.exe  - podmienia tylko silnik w runtime\

if not "%~1"=="" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%scripts\update-engine.ps1" -Engine "%~1"
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%scripts\build-native.ps1"
)

set "CODE=%ERRORLEVEL%"
if not "%CODE%"=="0" (
  echo.
  echo Operacja nie powiodla sie.
  pause
)
exit /b %CODE%
