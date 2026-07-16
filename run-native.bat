@echo off
setlocal
set "ROOT=%~dp0"
set "APP=%ROOT%NestCafe.exe"

if not exist "%APP%" (
  call "%ROOT%build-native.bat"
  if errorlevel 1 exit /b %ERRORLEVEL%
)

pushd "%ROOT%"
start "" "%APP%"
set "CODE=%ERRORLEVEL%"
popd
exit /b %CODE%
