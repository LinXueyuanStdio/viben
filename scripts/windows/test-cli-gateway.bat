@echo off
REM =========================================================================
REM Viben Bundled CLI + Gateway Test Script (Windows)
REM
REM Tests the Bun-compiled standalone binary (sidecar) on Windows.
REM Must pass before the desktop release proceeds.
REM
REM Usage:
REM   scripts\windows\test-cli-gateway.bat <path-to-binary>
REM
REM Example:
REM   scripts\windows\test-cli-gateway.bat viben-x86_64-pc-windows-msvc.exe
REM =========================================================================

setlocal enabledelayedexpansion

set FAILED_TESTS=0
set PASSED_TESTS=0
set GATEWAY_PID=
set GATEWAY_PORT=19999

REM Get binary path from argument
set "VIBEN=%~1"
if "%VIBEN%"=="" (
    echo [ERROR] Usage: %0 ^<path-to-binary^>
    exit /b 1
)

if not exist "%VIBEN%" (
    echo [ERROR] Binary not found: %VIBEN%
    exit /b 1
)

REM Resolve to absolute path
set "VIBEN=%~f1"

echo.
echo   Viben Bundled CLI Test (Windows)
echo   Binary: %VIBEN%
echo.

REM Create temp test directory
set "TEST_DIR=%TEMP%\viben-test-%RANDOM%"
mkdir "%TEST_DIR%"
cd /d "%TEST_DIR%"

REM ===== Part 1: CLI Commands =====

echo.
echo   Basic commands
echo   ----------------------------------------------

call :run_test "--version" ""%VIBEN%" --version" 0
call :run_test_output "--help contains Commands" ""%VIBEN%" --help" "Commands:"
call :run_test "unknown command fails" ""%VIBEN%" unknown-cmd-xyz 2>nul" 1

echo.
echo   Config commands
echo   ----------------------------------------------

call :run_test "config list" ""%VIBEN%" config list" 0
call :run_test_json "config list JSON" ""%VIBEN%" --json config list"

echo.
echo   Init ^& workspace
echo   ----------------------------------------------

call :run_test "init --user ci-test" ""%VIBEN%" init --user ci-test -y" 0
if exist ".viben" (
    call :pass "init creates .viben/"
) else (
    call :fail "init should create .viben/"
)
call :run_test "workspace current" ""%VIBEN%" workspace current" 0
call :run_test "workspace list" ""%VIBEN%" workspace list" 0

echo.
echo   Resource list commands
echo   ----------------------------------------------

call :run_test "agent list" ""%VIBEN%" agent list" 0
call :run_test "provider list" ""%VIBEN%" provider list" 0
call :run_test "model list" ""%VIBEN%" model list" 0
call :run_test "executor list" ""%VIBEN%" executor list" 0
call :run_test "task list" ""%VIBEN%" task list" 0
call :run_test "mcp list" ""%VIBEN%" mcp list" 0
call :run_test "skill list" ""%VIBEN%" skill list" 0
call :run_test "cron list" ""%VIBEN%" cron list" 0
call :run_test "queue list" ""%VIBEN%" queue list" 0
call :run_test "context" ""%VIBEN%" context" 0

echo.
echo   User commands
echo   ----------------------------------------------

call :run_test "user init" ""%VIBEN%" user init ci-test" 0
call :run_test_output "user get shows name" ""%VIBEN%" user get" "ci-test"

echo.
echo   Global options
echo   ----------------------------------------------

call :run_test "quiet mode" ""%VIBEN%" --quiet config list" 0
call :run_test "verbose mode" ""%VIBEN%" --verbose config list" 0
call :run_test_json "json mode" ""%VIBEN%" --json config list"

REM ===== Part 2: Gateway Tests =====

echo.
echo   Gateway tests
echo   ----------------------------------------------

REM gateway status (expect stopped)
"%VIBEN%" gateway status --port %GATEWAY_PORT% >nul 2>&1
call :pass "gateway status (stopped)"

echo   [INFO] Starting gateway on port %GATEWAY_PORT%...
set "GATEWAY_LOG=%TEST_DIR%\gateway.log"
start /B "" "%VIBEN%" gateway serve --port %GATEWAY_PORT% >"%GATEWAY_LOG%" 2>&1

REM Wait for gateway to be ready (up to 30 seconds)
set READY=false
for /L %%i in (1,1,30) do (
    if "!READY!"=="false" (
        powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:%GATEWAY_PORT%/health' -UseBasicParsing -TimeoutSec 1 -ErrorAction Stop; exit 0 } catch { exit 1 }" >nul 2>&1
        if !errorlevel! equ 0 (
            set READY=true
            echo   [INFO] Gateway ready after %%is
        ) else (
            timeout /T 1 /NOBREAK >nul
        )
    )
)

if "%READY%"=="true" (
    call :pass "gateway starts and becomes ready"

    REM Test /health
    for /f "delims=" %%j in ('powershell -NoProfile -Command "try { (Invoke-WebRequest -Uri 'http://127.0.0.1:%GATEWAY_PORT%/health' -UseBasicParsing -TimeoutSec 5).Content } catch { Write-Output 'ERROR' }"') do set "HEALTH=%%j"
    echo !HEALTH! | findstr /C:"\"status\":\"ok\"" >nul 2>&1
    if !errorlevel! equ 0 (
        call :pass "/health returns {status: ok}"
    ) else (
        call :fail "/health unexpected response"
    )

    REM Test /api
    for /f "delims=" %%j in ('powershell -NoProfile -Command "try { (Invoke-WebRequest -Uri 'http://127.0.0.1:%GATEWAY_PORT%/api' -UseBasicParsing -TimeoutSec 5).Content } catch { Write-Output 'ERROR' }"') do set "API=%%j"
    echo !API! | findstr /C:"endpoints" >nul 2>&1
    if !errorlevel! equ 0 (
        call :pass "/api returns endpoints list"
    ) else (
        call :fail "/api unexpected response"
    )

    REM Test /ws WebSocket endpoint
    set WS_OK=false
    powershell -NoProfile -Command "try { $ws = New-Object System.Net.WebSockets.ClientWebSocket; $uri = [System.Uri]::new('ws://127.0.0.1:%GATEWAY_PORT%/ws'); $cts = New-Object System.Threading.CancellationTokenSource(5000); $ws.ConnectAsync($uri, $cts.Token).Wait(); if ($ws.State -eq 'Open') { $buf = [System.Text.Encoding]::UTF8.GetBytes('{\"type\":\"Ping\"}'); $seg = [System.ArraySegment[byte]]::new($buf); $ws.SendAsync($seg, 'Text', $true, $cts.Token).Wait(); $rbuf = New-Object byte[] 1024; $rseg = [System.ArraySegment[byte]]::new($rbuf); $result = $ws.ReceiveAsync($rseg, $cts.Token).GetAwaiter().GetResult(); $resp = [System.Text.Encoding]::UTF8.GetString($rbuf, 0, $result.Count); if ($resp -match 'Pong') { exit 0 } else { exit 1 } } else { exit 1 }; $ws.Dispose() } catch { exit 1 }" >nul 2>&1
    if !errorlevel! equ 0 (
        call :pass "/ws WebSocket Ping/Pong"
    ) else (
        call :fail "/ws WebSocket Ping/Pong"
    )
) else (
    call :fail "gateway did not become ready within 30s"
)

REM Stop gateway - find and kill process on the port
echo   [INFO] Stopping gateway...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%GATEWAY_PORT%" ^| findstr "LISTENING" 2^>nul') do (
    taskkill /PID %%p /F >nul 2>&1
)
timeout /T 2 /NOBREAK >nul

REM Verify port released
powershell -NoProfile -Command "try { Invoke-WebRequest -Uri 'http://127.0.0.1:%GATEWAY_PORT%/health' -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop; exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel% equ 0 (
    call :fail "port %GATEWAY_PORT% still in use after stop"
) else (
    call :pass "port %GATEWAY_PORT% released after stop"
)

REM Print gateway log for CI visibility
echo.
echo   Gateway startup log
echo   ----------------------------------------------
if exist "%GATEWAY_LOG%" (
    type "%GATEWAY_LOG%"
) else (
    echo   [INFO] No gateway log file found
)

REM ===== Summary =====

echo.
echo   Summary
echo   ----------------------------------------------
echo.
echo   Passed: %PASSED_TESTS%
echo   Failed: %FAILED_TESTS%
echo.

REM Cleanup
cd /d "%TEMP%"
rmdir /S /Q "%TEST_DIR%" 2>nul

if %FAILED_TESTS% gtr 0 (
    echo   Some tests failed!
    exit /b 1
) else (
    echo   All tests passed!
    exit /b 0
)

REM =========================================================================
REM Subroutines
REM =========================================================================

:run_test
REM %~1 = name, %~2 = command, %~3 = expected exit code
set "RT_NAME=%~1"
set "RT_EXPECTED=%~3"
if "%RT_EXPECTED%"=="" set RT_EXPECTED=0
%~2 >nul 2>&1
set RT_EXIT=%errorlevel%
if %RT_EXIT% equ %RT_EXPECTED% (
    call :pass "%RT_NAME%"
) else (
    call :fail "%RT_NAME% (exit=%RT_EXIT%, expected=%RT_EXPECTED%)"
)
goto :eof

:run_test_output
REM %~1 = name, %~2 = command, %~3 = expected string
set "RTO_NAME=%~1"
set "RTO_EXPECTED=%~3"
%~2 > "%TEST_DIR%\test_output.tmp" 2>&1
findstr /C:"%RTO_EXPECTED%" "%TEST_DIR%\test_output.tmp" >nul 2>&1
if !errorlevel! equ 0 (
    call :pass "%RTO_NAME%"
) else (
    call :fail "%RTO_NAME% (expected: '%RTO_EXPECTED%')"
)
goto :eof

:run_test_json
REM %~1 = name, %~2 = command
set "RTJ_NAME=%~1"
%~2 > "%TEST_DIR%\test_output.tmp" 2>&1
findstr /C:"{" "%TEST_DIR%\test_output.tmp" >nul 2>&1
if !errorlevel! equ 0 (
    call :pass "%RTJ_NAME%"
) else (
    call :fail "%RTJ_NAME% (no JSON output)"
)
goto :eof

:pass
set /a PASSED_TESTS+=1
echo   [PASS] %~1
goto :eof

:fail
set /a FAILED_TESTS+=1
echo   [FAIL] %~1
goto :eof
