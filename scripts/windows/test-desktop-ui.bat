@echo off
REM Viben Desktop E2E Test Script (Windows)
REM
REM Tests the desktop app on Windows using WebdriverIO and tauri-driver.
REM
REM Usage:
REM   scripts\windows\test-desktop-ui.bat

setlocal EnableDelayedExpansion

echo.
echo   Viben Desktop E2E Test (Windows)
echo.

set "TAURI_DRIVER_PID="
set "TEST_EXIT_CODE=0"

REM =============================================================================
REM Step 1: Install MSI package
REM =============================================================================
echo   Installing Desktop App
echo   ----------------------------------------------

for /r desktop-artifact %%f in (*.msi) do (
    set "MSI_FILE=%%f"
    goto found_msi
)
echo [FAIL] No .msi file found in desktop-artifact\
exit /b 1

:found_msi
echo [INFO] Installing %MSI_FILE%...
msiexec /i "%MSI_FILE%" /quiet /norestart /log install.log ALLUSERS=1

if %ERRORLEVEL% NEQ 0 (
    echo [FAIL] MSI installation failed
    if exist install.log type install.log
    exit /b 1
)
echo [PASS] Desktop app installed

REM Wait for installation to complete
timeout /t 3 /nobreak >nul

REM =============================================================================
REM Step 2: Find installed app path
REM =============================================================================
echo.
echo   Locating Installed App
echo   ----------------------------------------------

set "APP_PATH="

REM Check common installation locations
if exist "%LOCALAPPDATA%\Programs\Viben\viben-desktop.exe" (
    set "APP_PATH=%LOCALAPPDATA%\Programs\Viben\viben-desktop.exe"
    goto found_app
)

if exist "%PROGRAMFILES%\Viben\viben-desktop.exe" (
    set "APP_PATH=%PROGRAMFILES%\Viben\viben-desktop.exe"
    goto found_app
)

if exist "%PROGRAMFILES(x86)%\Viben\viben-desktop.exe" (
    set "APP_PATH=%PROGRAMFILES(x86)%\Viben\viben-desktop.exe"
    goto found_app
)

REM Search for the executable
for /r "%LOCALAPPDATA%\Programs" %%f in (viben-desktop.exe) do (
    set "APP_PATH=%%f"
    goto found_app
)

for /r "%PROGRAMFILES%" %%f in (viben-desktop.exe) do (
    set "APP_PATH=%%f"
    goto found_app
)

echo [FAIL] Could not find installed Viben app
echo Searched in:
echo   - %LOCALAPPDATA%\Programs\Viben\
echo   - %PROGRAMFILES%\Viben\
exit /b 1

:found_app
echo [INFO] Found app at: %APP_PATH%
set "TAURI_APP_PATH=%APP_PATH%"

REM =============================================================================
REM Step 3: Start tauri-driver
REM =============================================================================
echo.
echo   Starting tauri-driver
echo   ----------------------------------------------

echo [INFO] Starting tauri-driver on port 4444...
start /b tauri-driver > tauri-driver.log 2>&1

REM Wait for tauri-driver to be ready
timeout /t 3 /nobreak >nul

REM Check if tauri-driver is running by checking if port 4444 is listening
netstat -an | findstr ":4444" | findstr "LISTENING" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [WARN] tauri-driver may not be listening on port 4444
) else (
    echo [PASS] tauri-driver started
)

REM =============================================================================
REM Step 4: Run E2E tests
REM =============================================================================
echo.
echo   Running E2E Tests
echo   ----------------------------------------------

echo [INFO] Running WebdriverIO tests...

if not exist test-screenshots mkdir test-screenshots

pushd apps\desktop
call npx wdio run wdio.conf.ts
set "TEST_EXIT_CODE=%ERRORLEVEL%"
popd

REM =============================================================================
REM Step 5: Cleanup and Summary
REM =============================================================================
echo.
echo   Summary
echo   ----------------------------------------------

REM Kill tauri-driver
taskkill /f /im tauri-driver.exe >nul 2>&1

REM Copy results
if exist apps\desktop\wdio-results.xml copy apps\desktop\wdio-results.xml . >nul
if exist apps\desktop\test-screenshots\* xcopy /s /y apps\desktop\test-screenshots\* test-screenshots\ >nul 2>&1

REM Count screenshots
set "SCREENSHOT_COUNT=0"
for %%f in (test-screenshots\*.png) do set /a SCREENSHOT_COUNT+=1
echo [INFO] Screenshots captured: %SCREENSHOT_COUNT%

if exist wdio-results.xml echo [INFO] Test results saved to wdio-results.xml

if %TEST_EXIT_CODE%==0 (
    echo.
    echo   All E2E tests passed!
) else (
    echo.
    echo   E2E tests failed (exit code: %TEST_EXIT_CODE%)
)

exit /b %TEST_EXIT_CODE%
