@echo off
cd /d "%~dp0"
chcp 65001 >nul

echo ========================================
echo   NestCafe - Starting Development
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not installed. Install Node.js 24+ first.
    pause
    exit /b 1
)

echo [OK] Node.js found:
node --version
echo.

for /f "tokens=1 delims=." %%v in ('node -p "process.versions.node"') do set NODE_MAJOR=%%v
if %NODE_MAJOR% lss 24 (
    echo [ERROR] This project requires Node.js 24 or newer.
    echo [ERROR] Your Node.js version is:
    node --version
    echo.
    echo Install Node.js 24+ from https://nodejs.org/ and run this file again.
    pause
    exit /b 1
)

REM Check if pnpm is installed
where pnpm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] pnpm is not installed. Install it with: npm install -g pnpm
    pause
    exit /b 1
)

echo [OK] pnpm found:
call pnpm --version
echo.

REM Check if node_modules exists, if not install dependencies
if not exist "node_modules\" (
    echo [INFO] Installing dependencies...
    call pnpm install
    if errorlevel 1 (
        echo [ERROR] Failed to install dependencies
        pause
        exit /b 1
    )
    echo.
)

echo [INFO] Starting dev server...
echo [INFO] Cleaning stale dev server on port 5173...
call pnpm dev:kill
echo.
call pnpm dev
if errorlevel 1 (
    echo [ERROR] Failed to start NestCafe
    pause
    exit /b 1
)
pause
