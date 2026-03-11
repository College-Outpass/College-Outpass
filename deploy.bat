@echo off
setlocal

echo.
echo ==============================================
echo COLLEGE OUTPASS - DEPLOYMENT TOOL v2.2
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
echo [1/5] Indexing files...
git add .
if %errorlevel% neq 0 (
    echo [ERROR] Failed to add files.
    pause
    exit /b
)

echo.
set "commitMsg=Update: General System Enhancements"
set /p userInput="[2/5] Enter update summary (or press ENTER for default): "
if not "%userInput%"=="" set "commitMsg=%userInput%"

echo.
echo [3/5] Committing changes...
git commit -m "%commitMsg%"
if %errorlevel% neq 0 (
    echo [INFO] No new changes to commit or commit failed.
)

echo.
echo [4/5] Pushing to GitHub...
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
        echo [ERROR] GitHub push failed.
        pause
        exit /b
    )
)

:: 4. TRIGGER RENDER DEPLOY HOOK
echo.
echo [5/5] Triggering Render Deploy Hook...
powershell -Command "Invoke-RestMethod -Uri 'https://api.render.com/deploy/srv-d6lvh724d50c73ciedo0?key=AnNe9gTr_oM' -Method Post"

if %errorlevel% == 0 (
    echo.
    echo ==============================================
    echo SUCCESS: Updates sent and Deploy Hook fired!
    echo ==============================================
    echo.
    echo Build Status: https://dashboard.render.com
    echo API Health: https://college-outpass-api.onrender.com/hello
    echo.
    echo ==============================================
) else (
    echo.
    echo [WARNING] Render Hook failed, but GitHub push succeeded.
    echo Your changes will still deploy if Auto-Deploy is ON.
)

echo.
echo Press any key to exit...
pause >nul
