@echo off
echo.
echo ===================================================
echo   XSS Validator - Burp Suite Integration Server
echo   Modern Playwright-based XSS Detection v2.0
echo ===================================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if package.json exists
if not exist "package.json" (
    echo ERROR: package.json not found
    echo Please run this script from the project root directory
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
    if errorlevel 1 (
        echo ERROR: Failed to install dependencies
        pause
        exit /b 1
    )
)

echo Starting XSS Validator server for Burp Suite...
echo.
echo Configuration:
echo   - Host: 127.0.0.1
echo   - Port: 8093
echo   - Optimized for Burp Suite integration
echo.
echo Instructions:
echo   1. Load burp-extension/ModernXSSValidator.py in Burp Suite
echo   2. Configure extension to use 127.0.0.1:8093
echo   3. Enable auto-testing and start using Intruder!
echo.
echo Press Ctrl+C to stop the server when done.
echo.

REM Start the server
node start-burp-suite-server.js

echo.
echo Server stopped.
pause