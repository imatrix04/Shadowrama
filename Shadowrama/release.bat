@echo off
setlocal

echo ========================================
echo   Release Shadowrama
echo ========================================

for /f "tokens=2 delims=:, " %%v in ('findstr "version" package.json') do set CURRENT_VERSION=%%v
echo Version actuelle : %CURRENT_VERSION%
echo.

REM Demande la nouvelle version a l'utilisateur
set /p VERSION="Entrez la nouvelle version (ex: 0.8.2) : "

if "%VERSION%"=="" (
    echo Aucune version saisie, annulation.
    goto end
)

echo.
echo Mise a jour de package.json vers %VERSION%...
call npm version %VERSION% --no-git-tag-version
if errorlevel 1 goto error

echo.
echo Commit et tag git...
git add .
git commit -m "v%VERSION%"
if errorlevel 1 goto error

git tag v%VERSION%
if errorlevel 1 goto error

git push origin main --tags
if errorlevel 1 goto error

echo.
echo Build et publication sur GitHub...
call npm run build
if errorlevel 1 goto error

call npm run release
if errorlevel 1 goto error

echo.
echo ========================================
echo   Release v%VERSION% publiee avec succes !
echo   Va sur GitHub pour finaliser le draft.
echo ========================================
goto end

:error
echo.
echo Une erreur est survenue. Verifie les logs ci-dessus.

:end
endlocal
pause