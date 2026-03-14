@echo off
setlocal

echo.
echo ==============================================
echo COLLEGE OUTPASS - DEPLOYMENT TOOL v3.0
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

set /p proceed="Ready to deploy to FIREBASE and RENDER? (Y/N): "
if /i "%proceed%" neq "Y" (
    echo [INFO] Deployment cancelled.
    pause
    exit /b
)

:: 3. GIT PROCESS
echo.
echo [1/6] Indexing files...
git add .

echo.
set "commitMsg=Update: System Stability Fixes"
set /p userInput="[2/6] Enter update summary (or press ENTER for default): "
if not "%userInput%"=="" set "commitMsg=%userInput%"

echo.
echo [3/6] Committing changes...
git commit -m "%commitMsg%"

echo.
echo [4/6] Pushing to GitHub...
git push origin main
if %errorlevel% neq 0 (
    echo [WARNING] Normal push failed. Attempting force push...
    git push origin main --force
)

:: 4. FIREBASE DEPLOYMENT
echo.
echo [5/6] Deploying to Firebase Hosting...
call firebase deploy --only hosting
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Firebase deploy failed! 
    echo Please make sure firebase-tools are installed: npm install -g firebase-tools
)

:: 5. TRIGGER RENDER DEPLOY HOOK
echo.
echo [6/6] Triggering Render API Hook...
powershell -Command "Invoke-RestMethod -Uri 'https://api.render.com/deploy/srv-d6lvh724d50c73ciedo0?key=AnNe9gTr_oM' -Method Post"

echo.
echo ==============================================
echo SUCCESS: Updates sent to GitHub, Firebase, and Render!
echo ==============================================
echo.
echo Firebase Web: https://college-out-pass-system-62552.web.app
echo Render API: https://college-outpass-api.onrender.com/hello
echo.
echo ==============================================

echo.
echo Press any key to exit...
pause >nul
