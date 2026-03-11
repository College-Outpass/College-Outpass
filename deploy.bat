@echo off
setlocal enabledelayedexpansion

:: ==========================================
:: 🚀 PRO DEPLOYMENT TOOL - COLLEGE OUTPASS
:: ==========================================

echo.
echo  ############################################
echo  #                                          #
echo  #   COLLEGE OUTPASS - DEPLOYMENT TOOL      #
echo  #    (TiDB Authentication & Security)      #
echo  #                                          #
echo  ############################################
echo.

:: 1. PREREQUISITE CHECK
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Git is not installed! 
    echo Please install Git to deploy to Render.
    pause
    exit /b
)

:: 2. SHOW CHANGES
echo [INFO] Scanning for project updates...
echo.
git status -s
echo.

set /p proceed="🚀 Ready to deploy to Render? (Y/N): "
if /i "%proceed%" neq "Y" (
    echo [INFO] Deployment cancelled by user.
    exit /b
)

:: 3. GIT PROCESS
echo.
echo 📥 Stage 1: Indexing files...
git add .

echo.
set "defaultMsg=🚀 DEPLOY: Unified TiDB Authentication, Staff Management UI, and Enhanced Security"
set /p commitMsg="📝 Stage 2: Enter update summary (or press ENTER for default): "
if "%commitMsg%"=="" set "commitMsg=%defaultMsg%"

echo.
echo 🛠️ Stage 3: Committing changes...
git commit -m "!commitMsg!"

echo.
echo 📤 Stage 4: Pushing to Render/Cloud...
git push origin main

if %errorlevel% neq 0 (
    echo.
    echo ❌ [ERROR] Deployment push failed! 
    echo Check your internet connection or repository permissions.
) else (
    echo.
    echo ========================================================
    echo ✅ SUCCESS: Updates are being deployed!
    echo ========================================================
    echo.
    echo 🛰️  API Status: https://college-outpass-api.onrender.com/hello
    echo 📋 Render Portal: https://dashboard.render.com
    echo.
    echo ========================================================
)

echo.
echo Press any key to exit...
pause >nul
