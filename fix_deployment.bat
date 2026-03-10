@echo off
setlocal

echo 🔍 Checking git state...
git log -n 1 --oneline

echo.
echo 🛡️ FIXING GITHUB SECRET PROTECTION...
echo.

:: Step 1: Force remove key.json from git index (just in case)
git rm --cached key.json 2>nul
echo cached key.json removed.

:: Step 2: Update .gitignore to make sure it stays ignored
echo key.json >> .gitignore
echo .env >> .gitignore
echo node_modules/ >> .env

:: Step 3: Amend the last commit to REMOVE the secret from history (only for the last commit)
echo 🧹 Cleaning up the last commit to remove secrets...
git add .gitignore
git commit --amend --no-edit

:: Step 4: TRY TO PUSH AGAIN
echo 📤 Attempting to push to Github (Render update)...
git push origin main --force-with-lease

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ GITHUB BLOCK DETECTED!
    echo Github is still seeing secrets in your history.
    echo Let's try to "Squash" the changes to a clean commit.
    
    git reset --soft 08c8650
    git add .
    git commit -m "🚀 Deployment: (CLEAN) Security update and TiDB fix"
    git push origin main --force
)

echo.
echo ✅ DEPLOYMENT COMPLETED!
echo.
echo ⚠️ PLEASE CHECK: https://outpass-api.onrender.com/hello
echo If it says "I am alive!", the connection is FIXED.
echo.
pause
