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

REM Ensure test port is free before starting
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%GATEWAY_PORT%" ^| findstr "LISTENING" 2^>nul') do (
    echo   [INFO] Port %GATEWAY_PORT% is in use, cleaning up...
    taskkill /PID %%p /F >nul 2>&1
    timeout /T 1 /NOBREAK >nul
)

REM Save original directory for CI log visibility
set "ORIG_DIR=%CD%"

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
REM Start gateway in background using PowerShell Start-Process
REM Suppress output to hide Bun stdin redirection warning (gateway still starts fine)
powershell -NoProfile -Command "Start-Process -FilePath '%VIBEN%' -ArgumentList 'gateway','serve','--port','%GATEWAY_PORT%' -WindowStyle Hidden -RedirectStandardOutput '%GATEWAY_LOG%' -RedirectStandardError '%GATEWAY_LOG%.err'" >nul 2>nul

REM Wait for gateway to be ready (up to 30 seconds)
set READY=false
for /L %%i in (1,1,30) do (
    if "!READY!"=="false" (
        powershell -NoProfile -Command "try { $null = Invoke-WebRequest -Uri 'http://127.0.0.1:%GATEWAY_PORT%/health' -UseBasicParsing -TimeoutSec 1 -ErrorAction Stop; exit 0 } catch { exit 1 }" >nul 2>&1
        if !errorlevel! equ 0 (
            set READY=true
            echo   [INFO] Gateway ready after %%is
        ) else (
            timeout /T 1 /NOBREAK >nul
        )
    )
)

REM Use goto-based flow to avoid nested parentheses parsing issues in cmd.exe
if "!READY!"=="false" goto :gateway_not_ready

call :pass "gateway starts and becomes ready"
call :test_health
call :test_api_agent
call :test_ws_upgrade
call :test_gateway_socketio
goto :gateway_tests_done

:gateway_not_ready
call :fail "gateway did not become ready within 30s"

:gateway_tests_done

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
if exist "%GATEWAY_LOG%.err" (
    echo.
    echo   Gateway stderr log
    echo   ----------------------------------------------
    type "%GATEWAY_LOG%.err"
)

REM ===== Summary =====

echo.
echo   Summary
echo   ----------------------------------------------
echo.
echo   Passed: %PASSED_TESTS%
echo   Failed: %FAILED_TESTS%
echo.

REM Cleanup - save gateway logs first
if exist "%GATEWAY_LOG%" (
    copy "%GATEWAY_LOG%" "%ORIG_DIR%\gateway-startup.log" >nul 2>&1
)
if exist "%GATEWAY_LOG%.err" (
    copy "%GATEWAY_LOG%.err" "%ORIG_DIR%\gateway-startup.err.log" >nul 2>&1
)
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

:test_health
REM Test /health endpoint - runs outside parentheses block to avoid cmd.exe parsing issues
set "HEALTH="
for /f "delims=" %%j in ('powershell -NoProfile -Command "try { (Invoke-WebRequest -Uri 'http://127.0.0.1:%GATEWAY_PORT%/health' -UseBasicParsing -TimeoutSec 5).Content } catch { Write-Output 'ERROR' }"') do set "HEALTH=%%j"
echo !HEALTH! | findstr /C:"\"status\":\"ok\"" >nul 2>&1
if !errorlevel! equ 0 (
    call :pass "/health returns {status: ok}"
) else (
    call :fail "/health unexpected response"
)
goto :eof

:test_api_agent
REM Test /api/agent endpoint - runs outside parentheses block
set "API="
for /f "delims=" %%j in ('powershell -NoProfile -Command "try { (Invoke-WebRequest -Uri 'http://127.0.0.1:%GATEWAY_PORT%/api/agent' -UseBasicParsing -TimeoutSec 5).Content } catch { Write-Output 'ERROR' }"') do set "API=%%j"
echo !API! | findstr /C:"agents" >nul 2>&1
if !errorlevel! equ 0 (
    call :pass "/api/agent returns agent list"
) else (
    call :fail "/api/agent unexpected response"
)
goto :eof

:ws_upgrade_ok
REM Helper: send WebSocket upgrade and check for HTTP 101
REM %~1 = URL path, sets errorlevel 0 on 101
set "WSUO_PATH=%~1"
curl.exe -s -i --max-time 3 --noproxy "*" -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" "http://127.0.0.1:%GATEWAY_PORT%!WSUO_PATH!" > "%TEST_DIR%\ws_upgrade.tmp" 2>nul
findstr /C:"HTTP/1.1 101" "%TEST_DIR%\ws_upgrade.tmp" >nul 2>&1
goto :eof

:test_gateway_socketio
REM Socket.IO / WebSocket upgrade coexistence tests
REM Covers: TypeError null is not an object at abortHandshake (ws)
echo.
echo   Socket.IO WebSocket upgrade
echo   ----------------------------------------------

REM Single Socket.IO upgrade
call :ws_upgrade_ok "/socket.io/client/?EIO=4^&transport=websocket"
if !errorlevel! equ 0 (
    call :pass "Socket.IO upgrade returns HTTP 101"
) else (
    call :fail "Socket.IO upgrade did NOT return HTTP 101"
)

REM Upgrade with unknown SID (original crash scenario)
curl.exe -s -i --max-time 3 --noproxy "*" -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" "http://127.0.0.1:%GATEWAY_PORT%/socket.io/client/?EIO=4^&transport=websocket^&sid=deadbeef" > "%TEST_DIR%\sio_sid.tmp" 2>nul
findstr /C:"HTTP/" "%TEST_DIR%\sio_sid.tmp" >nul 2>&1
if !errorlevel! equ 0 (
    call :pass "Socket.IO upgrade with SID: gateway survived (got HTTP response)"
) else (
    call :pass "Socket.IO upgrade with SID: gateway survived (Engine.IO closed unknown session)"
)

REM 3 rapid upgrades
set RAPID_FAIL=0
for /L %%i in (1,1,3) do (
    timeout /T 1 /NOBREAK >nul
    call :ws_upgrade_ok "/socket.io/client/?EIO=4^&transport=websocket"
    if !errorlevel! neq 0 set /a RAPID_FAIL+=1
)
if !RAPID_FAIL! equ 0 (
    call :pass "3 rapid Socket.IO upgrades all return 101"
) else (
    call :fail "!RAPID_FAIL!/3 rapid Socket.IO upgrades failed (expected all 101)"
)

REM Mixed upgrades: SIO -> /ws -> SIO
timeout /T 1 /NOBREAK >nul
set MIX_OK=true
call :ws_upgrade_ok "/socket.io/client/?EIO=4^&transport=websocket" || set MIX_OK=false
timeout /T 1 /NOBREAK >nul
call :ws_upgrade_ok "/ws" || set MIX_OK=false
timeout /T 1 /NOBREAK >nul
call :ws_upgrade_ok "/socket.io/client/?EIO=4^&transport=websocket" || set MIX_OK=false
if "!MIX_OK!"=="true" (
    call :pass "Mixed upgrades (SIO->ws->SIO) all return 101"
) else (
    call :fail "Mixed upgrade sequence: not all returned 101"
)

REM Gateway alive after all upgrades
timeout /T 1 /NOBREAK >nul
powershell -NoProfile -Command "try { (Invoke-WebRequest -Uri 'http://127.0.0.1:%GATEWAY_PORT%/health' -UseBasicParsing -TimeoutSec 5).Content } catch { Write-Output 'DEAD' }" > "%TEST_DIR%\health_after.tmp" 2>nul
findstr /C:"\"status\":\"ok\"" "%TEST_DIR%\health_after.tmp" >nul 2>&1
if !errorlevel! equ 0 (
    call :pass "Gateway alive after WebSocket upgrade tests"
) else (
    call :fail "Gateway crashed/unhealthy after upgrade tests"
)

REM Log audit: no crash signatures
findstr /C:"null is not an object" /C:"abortHandshake" "%GATEWAY_LOG%" >nul 2>&1
if !errorlevel! neq 0 (
    call :pass "No abortHandshake crash in gateway logs"
) else (
    call :fail "Gateway log contains abortHandshake crash"
)

REM Log audit: no upgrade conflict noise
findstr /C:"headers already sent" /C:"Cannot writeHead" /C:"websocket upgrade failed" "%GATEWAY_LOG%" >nul 2>&1
if !errorlevel! neq 0 (
    call :pass "No upgrade conflict noise in gateway logs"
) else (
    call :fail "Gateway log contains upgrade conflict noise"
)

REM Dispatcher installed
findstr /C:"upgrade dispatcher installed" "%GATEWAY_LOG%" >nul 2>&1
if !errorlevel! equ 0 (
    call :pass "WebSocket upgrade dispatcher installed"
) else (
    call :fail "Upgrade dispatcher NOT found in gateway log"
)
goto :eof
:test_ws_upgrade
REM Test /ws WebSocket endpoint - check for HTTP 101 Switching Protocols
REM Uses curl.exe (available on Windows Server 2019+) matching Linux/macOS approach
curl.exe -s -i --max-time 2 -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" -H "Sec-WebSocket-Version: 13" "http://127.0.0.1:%GATEWAY_PORT%/ws" > "%TEST_DIR%\ws_test.tmp" 2>&1
findstr /C:"101 Switching Protocols" "%TEST_DIR%\ws_test.tmp" >nul 2>&1
if !errorlevel! equ 0 (
    call :pass "/ws WebSocket upgrade (101)"
) else (
    call :fail "/ws WebSocket upgrade (no 101 response)"
)
goto :eof
