@echo off
REM Generate GitHub Job Summary for Windows Desktop E2E test results
REM Usage: test-desktop-summary.bat [screenshots_dir] [wdio_results_xml]

setlocal EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
set "SCREENSHOTS_DIR=%~1"
set "WDIO_RESULTS=%~2"

if "!SCREENSHOTS_DIR!"=="" set "SCREENSHOTS_DIR=test-screenshots"
if "!WDIO_RESULTS!"=="" set "WDIO_RESULTS=wdio-results.xml"

if "!GITHUB_STEP_SUMMARY!"=="" (
    set "SUMMARY_FILE=CON"
) else (
    set "SUMMARY_FILE=!GITHUB_STEP_SUMMARY!"
)

echo ## Windows Desktop E2E 测试报告 >> "!SUMMARY_FILE!"
echo. >> "!SUMMARY_FILE!"

REM =============================================================================
REM Test Environment
REM =============================================================================
echo ### 测试环境 >> "!SUMMARY_FILE!"
echo. >> "!SUMMARY_FILE!"
echo ^| 配置 ^| 值 ^| >> "!SUMMARY_FILE!"
echo ^|------^|-----^| >> "!SUMMARY_FILE!"
echo ^| 系统 ^| Windows x64 ^| >> "!SUMMARY_FILE!"
echo ^| 测试框架 ^| WebdriverIO + tauri-driver ^| >> "!SUMMARY_FILE!"
if not "!GITHUB_RUN_ID!"=="" (
    echo ^| 运行 ^| [#!GITHUB_RUN_ID!](https://github.com/!GITHUB_REPOSITORY!/actions/runs/!GITHUB_RUN_ID!^) ^| >> "!SUMMARY_FILE!"
)
echo. >> "!SUMMARY_FILE!"

REM =============================================================================
REM Test Results
REM =============================================================================
if exist "!WDIO_RESULTS!" (
    set "TESTS=0"
    set "FAILURES=0"
    set "ERRORS=0"

    REM Parse JUnit XML using findstr
    for /f "tokens=2 delims==" %%a in ('findstr /C:"tests=" "!WDIO_RESULTS!" 2^>nul') do (
        set "val=%%~a"
        set "val=!val: =!"
        for /f "tokens=1 delims= " %%b in ("!val!") do set "TESTS=%%~b"
    )

    for /f "tokens=2 delims==" %%a in ('findstr /C:"failures=" "!WDIO_RESULTS!" 2^>nul') do (
        set "val=%%~a"
        set "val=!val: =!"
        for /f "tokens=1 delims= " %%b in ("!val!") do set "FAILURES=%%~b"
    )

    for /f "tokens=2 delims==" %%a in ('findstr /C:"errors=" "!WDIO_RESULTS!" 2^>nul') do (
        set "val=%%~a"
        set "val=!val: =!"
        for /f "tokens=1 delims= " %%b in ("!val!") do set "ERRORS=%%~b"
    )

    if "!FAILURES!"=="0" if "!ERRORS!"=="0" (
        echo ### 测试通过 >> "!SUMMARY_FILE!"
    ) else (
        echo ### 测试失败 >> "!SUMMARY_FILE!"
    )

    echo. >> "!SUMMARY_FILE!"
    echo ^| 指标 ^| 数量 ^| >> "!SUMMARY_FILE!"
    echo ^|------^|------^| >> "!SUMMARY_FILE!"
    echo ^| 用例 ^| !TESTS! ^| >> "!SUMMARY_FILE!"
    echo ^| 失败 ^| !FAILURES! ^| >> "!SUMMARY_FILE!"
    echo ^| 错误 ^| !ERRORS! ^| >> "!SUMMARY_FILE!"
    echo. >> "!SUMMARY_FILE!"
) else (
    echo ### 无测试数据 >> "!SUMMARY_FILE!"
    echo. >> "!SUMMARY_FILE!"
)

REM =============================================================================
REM Screenshots
REM =============================================================================
echo ### 测试截图 >> "!SUMMARY_FILE!"
echo. >> "!SUMMARY_FILE!"

REM Count screenshots and collect them for upload.
set "SCREENSHOT_COUNT=0"
if exist "!SCREENSHOTS_DIR!\*.png" (
    for %%f in ("!SCREENSHOTS_DIR!\*.png") do (
        set /a SCREENSHOT_COUNT+=1
        set "SCREENSHOT_!SCREENSHOT_COUNT!=%%~ff"
    )
)

if !SCREENSHOT_COUNT! EQU 0 (
    echo _无截图_ >> "!SUMMARY_FILE!"
    goto :done
)

REM Check if we can upload.
if "!GITHUB_REPOSITORY!"=="" (
    echo _截图在 artifacts 中_ >> "!SUMMARY_FILE!"
    goto :done
)
if "!GITHUB_RUN_ID!"=="" (
    echo _截图在 artifacts 中_ >> "!SUMMARY_FILE!"
    goto :done
)
if "!GITHUB_TOKEN!"=="" (
    echo _截图在 artifacts 中_ >> "!SUMMARY_FILE!"
    goto :done
)

if exist UPLOADED_URLS.txt del UPLOADED_URLS.txt
if exist UPLOADED_URLS_ALL.txt del UPLOADED_URLS_ALL.txt

for /L %%i in (1,1,!SCREENSHOT_COUNT!) do (
    call "!SCRIPT_DIR!..\lib\upload-ci-assets.bat" "windows/!GITHUB_RUN_ID!" "!SCREENSHOT_%%i!"
    if not "!UPLOAD_SUCCESS!"=="1" goto :upload_failed
    if not exist UPLOADED_URLS.txt goto :upload_failed
    type UPLOADED_URLS.txt >> UPLOADED_URLS_ALL.txt
)

if not exist UPLOADED_URLS_ALL.txt goto :upload_failed

echo ^| 步骤 ^| 截图 ^| 说明 ^| >> "!SUMMARY_FILE!"
echo ^|:----:^|:----:^|:-----^| >> "!SUMMARY_FILE!"

set "UPLOADED_COUNT=0"
for /f "usebackq delims=" %%u in ("UPLOADED_URLS_ALL.txt") do (
    set /a UPLOADED_COUNT+=1
    set "URL=%%u"
    call set "ORIGINAL=%%SCREENSHOT_!UPLOADED_COUNT!%%"
    for %%n in ("!ORIGINAL!") do set "NAME=%%~nxn"
    call :get_screenshot_desc "!NAME!" DESC
    echo ^| !UPLOADED_COUNT! ^| ^![!DESC!^](!URL!^) ^| !DESC! ^| >> "!SUMMARY_FILE!"
)

echo. >> "!SUMMARY_FILE!"
echo _共 !UPLOADED_COUNT! 张截图_ >> "!SUMMARY_FILE!"
goto :done

:upload_failed
echo _上传失败，截图在 artifacts 中_ >> "!SUMMARY_FILE!"

:done
echo. >> "!SUMMARY_FILE!"
endlocal
exit /b 0

:get_screenshot_desc
set "SHOT_NAME=%~1"
set "SHOT_DESC=%~n1"

echo !SHOT_NAME! | findstr /I "launch main window" >nul
if !ERRORLEVEL! EQU 0 set "SHOT_DESC=主窗口"

echo !SHOT_NAME! | findstr /I "content area" >nul
if !ERRORLEVEL! EQU 0 set "SHOT_DESC=内容区域"

echo !SHOT_NAME! | findstr /I "error console" >nul
if !ERRORLEVEL! EQU 0 set "SHOT_DESC=错误检查"

echo !SHOT_NAME! | findstr /I "nav navigation sidebar" >nul
if !ERRORLEVEL! EQU 0 set "SHOT_DESC=导航栏"

echo !SHOT_NAME! | findstr /I "resize responsive" >nul
if !ERRORLEVEL! EQU 0 set "SHOT_DESC=窗口调整"

echo !SHOT_NAME! | findstr /I "final state" >nul
if !ERRORLEVEL! EQU 0 set "SHOT_DESC=最终状态"

for /f "tokens=* delims=-" %%d in ("!SHOT_DESC!") do set "SHOT_DESC=%%d"
set "%~2=!SHOT_DESC!"
exit /b 0
