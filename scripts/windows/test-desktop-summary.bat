@echo off
REM Generate GitHub Job Summary for Windows Desktop E2E test results
REM Usage: test-desktop-summary.bat [screenshots_dir] [wdio_results_xml]

setlocal EnableDelayedExpansion

set "SCREENSHOTS_DIR=%~1"
set "WDIO_RESULTS=%~2"

if "%SCREENSHOTS_DIR%"=="" set "SCREENSHOTS_DIR=test-screenshots"
if "%WDIO_RESULTS%"=="" set "WDIO_RESULTS=wdio-results.xml"

if "%GITHUB_STEP_SUMMARY%"=="" (
    set "SUMMARY_FILE=CON"
) else (
    set "SUMMARY_FILE=%GITHUB_STEP_SUMMARY%"
)

echo ## Windows Desktop E2E 测试报告 >> "%SUMMARY_FILE%"
echo. >> "%SUMMARY_FILE%"

REM =============================================================================
REM Test Environment
REM =============================================================================
echo ### 测试环境 >> "%SUMMARY_FILE%"
echo. >> "%SUMMARY_FILE%"
echo ^| 配置 ^| 值 ^| >> "%SUMMARY_FILE%"
echo ^|------^|-----^| >> "%SUMMARY_FILE%"
echo ^| 系统 ^| Windows x64 ^| >> "%SUMMARY_FILE%"
echo ^| 测试框架 ^| WebdriverIO + tauri-driver ^| >> "%SUMMARY_FILE%"
if not "%GITHUB_RUN_ID%"=="" (
    echo ^| 运行 ^| [#%GITHUB_RUN_ID%](https://github.com/%GITHUB_REPOSITORY%/actions/runs/%GITHUB_RUN_ID%) ^| >> "%SUMMARY_FILE%"
)
echo. >> "%SUMMARY_FILE%"

REM =============================================================================
REM Test Results
REM =============================================================================
if exist "%WDIO_RESULTS%" (
    set "TESTS=0"
    set "FAILURES=0"
    set "ERRORS=0"

    REM Parse JUnit XML using findstr
    for /f "tokens=2 delims==" %%a in ('findstr /C:"tests=" "%WDIO_RESULTS%" 2^>nul') do (
        set "val=%%~a"
        set "val=!val: =!"
        for /f "tokens=1 delims= " %%b in ("!val!") do set "TESTS=%%~b"
    )

    for /f "tokens=2 delims==" %%a in ('findstr /C:"failures=" "%WDIO_RESULTS%" 2^>nul') do (
        set "val=%%~a"
        set "val=!val: =!"
        for /f "tokens=1 delims= " %%b in ("!val!") do set "FAILURES=%%~b"
    )

    for /f "tokens=2 delims==" %%a in ('findstr /C:"errors=" "%WDIO_RESULTS%" 2^>nul') do (
        set "val=%%~a"
        set "val=!val: =!"
        for /f "tokens=1 delims= " %%b in ("!val!") do set "ERRORS=%%~b"
    )

    if "!FAILURES!"=="0" if "!ERRORS!"=="0" (
        echo ### 测试通过 >> "%SUMMARY_FILE%"
    ) else (
        echo ### 测试失败 >> "%SUMMARY_FILE%"
    )

    echo. >> "%SUMMARY_FILE%"
    echo ^| 指标 ^| 数量 ^| >> "%SUMMARY_FILE%"
    echo ^|------^|------^| >> "%SUMMARY_FILE%"
    echo ^| 用例 ^| !TESTS! ^| >> "%SUMMARY_FILE%"
    echo ^| 失败 ^| !FAILURES! ^| >> "%SUMMARY_FILE%"
    echo ^| 错误 ^| !ERRORS! ^| >> "%SUMMARY_FILE%"
    echo. >> "%SUMMARY_FILE%"
) else (
    echo ### 无测试数据 >> "%SUMMARY_FILE%"
    echo. >> "%SUMMARY_FILE%"
)

REM =============================================================================
REM Screenshots
REM =============================================================================
echo ### 测试截图 >> "%SUMMARY_FILE%"
echo. >> "%SUMMARY_FILE%"

REM Count screenshots
set "SCREENSHOT_COUNT=0"
if exist "%SCREENSHOTS_DIR%" (
    for %%f in ("%SCREENSHOTS_DIR%\*.png") do set /a SCREENSHOT_COUNT+=1
)

if %SCREENSHOT_COUNT%==0 (
    echo _无截图_ >> "%SUMMARY_FILE%"
    goto :done
)

REM Check if we can upload
if "%GITHUB_REPOSITORY%"=="" goto :no_upload
if "%GITHUB_RUN_ID%"=="" goto :no_upload
if "%GITHUB_TOKEN%"=="" goto :no_upload

REM Collect files for upload
set "FILE_LIST="
for %%f in ("%SCREENSHOTS_DIR%\*.png") do (
    set "FILE_LIST=!FILE_LIST! "%%f""
)

REM Call upload library
set "UPLOAD_DIR=windows/%GITHUB_RUN_ID%"
call "%~dp0..\lib\upload-ci-assets.bat" %UPLOAD_DIR% %FILE_LIST%

if "%UPLOAD_SUCCESS%"=="1" (
    echo ^| 步骤 ^| 截图 ^| 说明 ^| >> "%SUMMARY_FILE%"
    echo ^|:----:^|:----:^|:-----^| >> "%SUMMARY_FILE%"

    set "IDX=0"
    for /f "delims=" %%u in (UPLOADED_URLS.txt) do (
        set /a IDX+=1
        for %%n in ("%%u") do set "NAME=%%~nxn"
        echo ^| !IDX! ^| ![截图](%%u^) ^| !NAME! ^| >> "%SUMMARY_FILE%"
    )

    echo. >> "%SUMMARY_FILE%"
    echo _共 !IDX! 张截图_ >> "%SUMMARY_FILE%"
) else (
    goto :no_upload
)

goto :done

:no_upload
echo _截图在 artifacts 中_ >> "%SUMMARY_FILE%"

:done
endlocal
exit /b 0
