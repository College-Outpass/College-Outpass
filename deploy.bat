@echo off
setlocal enabledelayedexpansion

echo.
echo ==============================================
echo COLLEGE OUTPASS - DEPLOYMENT TOOL v3.1
echo ==============================================
echo.

:: 1. PREREQUISITE CHECK
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not recognized. Please install Node.js.
    pause
    exit /b 1
)

:: 1.0. GIT DETECTION
set "GIT_EXE=git"
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Git not in PATH, searching in common locations...
    if exist "C:\Program Files\Git\bin\git.exe" (
        set "GIT_EXE=C:\Program Files\Git\bin\git.exe"
    ) else if exist "C:\Program Files (x86)\Git\bin\git.exe" (
        set "GIT_EXE=C:\Program Files (x86)\Git\bin\git.exe"
    ) else (
        echo [ERROR] Git is not installed or not in a standard location.
        echo Please install Git or add it to your PATH.
        pause
        exit /b 1
    )
)

:: 1.1. FIREBASE DETECTION
set "FIREBASE_CMD=firebase"
where firebase >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Firebase global command not found, checking local node_modules...
    if exist "node_modules\.bin\firebase.cmd" (
        set "FIREBASE_CMD=node_modules\.bin\firebase.cmd"
    ) else (
        echo [INFO] Firebase not found in node_modules, checking for npx...
        where npx >nul 2>&1
        if !errorlevel! equ 0 (
            set "FIREBASE_CMD=npx firebase"
        ) else (
            echo [WARNING] Firebase CLI and npx not found.
        )
    )
)
echo [INFO] Using Firebase CLI: %FIREBASE_CMD%

:: 2. SCAN FOR UPDATES
echo [INFO] Scanning for project updates...
"%GIT_EXE%" status -s
if %errorlevel% neq 0 (
    echo [ERROR] Failed to get git status. Are you in a git repository?
    pause
    exit /b 1
)
echo.

set /p proceed="Ready to deploy to FIREBASE and RENDER? (Y/N): "
if /i "%proceed%" neq "Y" (
    echo [INFO] Deployment cancelled.
    pause
    exit /b 0
)

:: 3. GIT PROCESS
echo.
echo [1/6] Indexing files...
"%GIT_EXE%" add .
if %errorlevel% neq 0 (
    echo [ERROR] Git add failed.
    pause
    exit /b 1
)

echo.
set "commitMsg=Update: Project Sync %date% %time%"
set /p userInput="[2/6] Enter update summary (or press ENTER for default): "
if not "%userInput%"=="" set "commitMsg=%userInput%"

echo.
echo [3/6] Committing changes...
"%GIT_EXE%" commit -m "%commitMsg%"
if %errorlevel% neq 0 (
    echo [WARNING] Git commit failed or nothing to commit.
)

echo.
echo [4/6] Pushing to GitHub...
"%GIT_EXE%" push origin main
if %errorlevel% neq 0 (
    echo [WARNING] Normal push failed.
    set /p force="Force push? (Y/N): "
    if /i "!force!"=="Y" (
        "%GIT_EXE%" push origin main --force
    ) else (
        echo [ERROR] Push aborted by user.
        pause
        exit /b 1
    )
)

:: 4. FIREBASE DEPLOYMENT
echo.
echo [5/6] Deploying to Firebase Hosting...
call %FIREBASE_CMD% deploy --only hosting
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Firebase deploy failed! 
    echo Please make sure firebase-tools are installed and you are logged in.
    echo Run: npm install (if firebase-tools is in package.json)
    echo Or:  npm install -g firebase-tools ^& firebase login
    set "cont=N"
    set /p cont="Continue to Render trigger anyway? (Y/N): "
    if /i "!cont!" neq "Y" (
        echo [INFO] Deployment aborted.
        pause
        exit /b 1
    )
)

:: 5. TRIGGER RENDER DEPLOY HOOK
echo.
echo [6/6] Triggering Render API Hook...
powershell -Command "Invoke-RestMethod -Uri 'https://api.render.com/deploy/srv-d6lvh724d50c73ciedo0?key=AnNe9gTr_oM' -Method Post"
if %errorlevel% neq 0 (
    echo [WARNING] Render trigger failed.
)

echo.
echo ==============================================
echo SUCCESS: Updates processed!
echo ==============================================
echo.
echo Firebase Web: https://college-out-pass-system-62552.web.app
echo Render API: https://college-outpass-api.onrender.com/hello
echo.
echo ==============================================

echo.
echo Press any key to exit...
pause >nul
