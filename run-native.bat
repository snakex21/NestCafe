@echo off
setlocal
set "ROOT=%~dp0"
set "ENGINE=%ROOT%..\SuperCli\supercli-web.exe"

if not exist "%ENGINE%" (
  echo Nie znaleziono silnika SuperCli:
  echo %ENGINE%
  echo.
  echo Najpierw zbuduj SuperCli poleceniem:
  echo go build -o supercli-web.exe ./cmd/supercli-web
  pause
  exit /b 1
)

pushd "%ROOT%"
"%ENGINE%" --workspace "%ROOT%" --ui-dir "%ROOT%native-ui"
set "CODE=%ERRORLEVEL%"
popd
exit /b %CODE%
