@echo off
setlocal enabledelayedexpansion

:: ==========================================
:: 🚀 DEPLOYMENT SCRIPT FOR COLLEGE OUTPASS
:: ==========================================

echo.
echo  ############################################
echo  #                                          #
echo  #   COLLEGE OUTPASS - DEPLOYMENT TOOL      #
echo  #                                          #
echo  ############################################
echo.

:: Check for Git
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Git is not installed! Please install Git to deploy to Render.
    pause
    exit /b
)

echo [INFO] Detected changes in project...
echo.

:: Show status
git status

echo.
set /p proceed="Do you want to proceed with deployment? (Y/N): "
if /i "%proceed%" neq "Y" (
    echo [INFO] Deployment cancelled.
    exit /b
)

:: Step 1: Add all changes
echo.
echo [1/3] Adding files to git...
git add .

:: Step 2: Commit changes
echo.
set "defaultMsg=Update: Added manual security management and dashboard links"
set /p commitMsg="[2/3] Enter commit message (or press ENTER for default): "
if "%commitMsg%"=="" set "commitMsg=%defaultMsg%"

git commit -m "!commitMsg!"

:: Step 3: Push to remote
echo.
echo [3/3] Pushing code to repository...
git push

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Git push failed! 
    echo Please make sure you have a remote origin configured (git remote -v).
) else (
    echo.
    echo ========================================================
    echo ✅ SUCCESS: Code pushed to repository!
    echo ========================================================
    echo Render will now automatically start the build process.
    echo Visit your dashboard: https://dashboard.render.com
    echo ========================================================
)

echo.
pause
