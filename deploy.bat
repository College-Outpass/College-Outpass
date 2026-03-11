@echo off
setlocal

:: ==========================================
:: 🚀 PRO DEPLOYMENT TOOL v2.0 - COLLEGE OUTPASS
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

:: 2. SCAN FOR UPDATES
echo [INFO] Scanning for project updates...
echo.
git status -s
echo.

set /p proceed="🚀 Ready to deploy to Render? (Y/N): "
if /i "%proceed%" neq "Y" (
    echo [INFO] Deployment cancelled.
    exit /b
)

:: 3. SYNC WITH REMOTE (Optional but safer)
echo.
echo 🔄 Stage 1: Synchronizing with GitHub...
git fetch origin main

:: 4. GIT PROCESS
echo.
echo 📥 Stage 2: Indexing files...
git add .

echo.
set "commitMsg=🚀 DEPLOY: Unified TiDB Authentication and Security Fixes"
set /p userInput="📝 Stage 3: Enter update summary (or press ENTER for default): "
if not "%userInput%"=="" set "commitMsg=%userInput%"

echo.
echo 🛠️ Stage 4: Committing changes...
:: Using %commitMsg% directly without delayed expansion to avoid issues with special chars
git commit -m "%commitMsg%"

echo.
echo 📤 Stage 5: Pushing to Render/Cloud...
:: Try pushing normally first
git push origin main

if %errorlevel% neq 0 (
    echo.
    echo ⚠️  [WARNING] Normal push failed. 
    echo There might be a conflict with the server.
    
    set /p force="Would you like to FORCE the update? This fixes most errors. (Y/N): "
    if /i "%force%"=="Y" (
        echo.
        echo 🚀 Force pushing updates...
        git push origin main --force
    ) else (
        echo.
        echo ❌ Deployment failed. Please resolve conflicts manually.
        pause
        exit /b
    )
)

if %errorlevel% == 0 (
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
