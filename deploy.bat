@echo off
setlocal

echo.
echo ==============================================
echo COLLEGE OUTPASS - DEPLOYMENT TOOL v2.1
echo ==============================================
echo.

:: 1. PREREQUISITE CHECK
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Git is not installed or not in PATH!
    pause
    exit /b
)

:: 2. SCAN FOR UPDATES
echo [INFO] Scanning for project updates...
echo.
git status -s
echo.

set /p proceed="Ready to deploy to Render? (Y/N): "
if /i "%proceed%" neq "Y" (
    echo [INFO] Deployment cancelled.
    pause
    exit /b
)

:: 3. GIT PROCESS
echo.
echo [1/4] Indexing files...
git add .
if %errorlevel% neq 0 (
    echo [ERROR] Failed to add files.
    pause
    exit /b
)

echo.
set "commitMsg=Update: Security and Staff Management Enhancements"
set /p userInput="[2/4] Enter update summary (or press ENTER for default): "
if not "%userInput%"=="" set "commitMsg=%userInput%"

echo.
echo [3/4] Committing changes...
git commit -m "%commitMsg%"
if %errorlevel% neq 0 (
    echo [INFO] No new changes to commit or commit failed.
)

echo.
echo [4/4] Pushing to Render...
:: Try pushing normally first
git push origin main

if %errorlevel% neq 0 (
    echo.
    echo [WARNING] Normal push failed.
    echo This usually happens if the server has changes you don't have.
    
    set /p force="Would you like to FORCE the update? (Y/N): "
    if /i "%force%"=="Y" (
        echo.
        echo [INFO] Force pushing updates...
        git push origin main --force
    ) else (
        echo.
        echo [ERROR] Deployment failed.
        pause
        exit /b
    )
)

if %errorlevel% == 0 (
    echo.
    echo ==============================================
    echo SUCCESS: Updates have been sent to Render!
    echo ==============================================
    echo.
    echo Build Status: https://dashboard.render.com
    echo API Health: https://college-outpass-api.onrender.com/hello
    echo.
    echo ==============================================
)

echo.
echo Press any key to exit...
pause >nul
