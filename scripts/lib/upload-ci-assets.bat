@echo off
REM Upload files to ci-assets branch using Git Data API (Windows Batch version)
REM Usage: call upload-ci-assets.bat <upload_dir> <file1> [file2] ...
REM
REM Environment variables required:
REM   GITHUB_REPOSITORY  - Repository in format owner/repo
REM   GITHUB_TOKEN       - GitHub token with contents:write permission
REM
REM Output:
REM   Creates UPLOADED_URLS.txt with one URL per line
REM   Sets UPLOAD_SUCCESS=1 on success, UPLOAD_SUCCESS=0 on failure

setlocal EnableDelayedExpansion

set "UPLOAD_DIR=%~1"
shift

if "%UPLOAD_DIR%"=="" (
    echo [ERROR] Usage: upload-ci-assets.bat ^<upload_dir^> ^<file1^> [file2] ...
    set "UPLOAD_SUCCESS=0"
    exit /b 1
)

if "%GITHUB_REPOSITORY%"=="" (
    echo [ERROR] GITHUB_REPOSITORY not set
    set "UPLOAD_SUCCESS=0"
    exit /b 1
)

if "%GITHUB_TOKEN%"=="" (
    echo [ERROR] GITHUB_TOKEN not set
    set "UPLOAD_SUCCESS=0"
    exit /b 1
)

set "API_BASE=https://api.github.com/repos/%GITHUB_REPOSITORY%"
set "BRANCH=ci-assets"
set "TEMP_DIR=%TEMP%\upload-ci-assets-%RANDOM%"
mkdir "%TEMP_DIR%" 2>nul

REM Clear output file
if exist UPLOADED_URLS.txt del UPLOADED_URLS.txt
type nul > UPLOADED_URLS.txt

REM Collect files to upload
set "FILE_COUNT=0"
:collect_files
if "%~1"=="" goto end_collect
if exist "%~1" (
    set /a FILE_COUNT+=1
    set "FILE_!FILE_COUNT!=%~1"
)
shift
goto collect_files
:end_collect

if %FILE_COUNT%==0 (
    echo [ERROR] No valid files to upload
    set "UPLOAD_SUCCESS=0"
    exit /b 1
)

echo [INFO] Uploading %FILE_COUNT% files to %UPLOAD_DIR%...

REM Step 1: Get current commit SHA
echo [INFO] Getting branch reference...
curl -s -H "Authorization: token %GITHUB_TOKEN%" "%API_BASE%/git/ref/heads/%BRANCH%" > "%TEMP_DIR%\ref.json"

for /f "tokens=2 delims=:," %%a in ('findstr /C:"\"sha\"" "%TEMP_DIR%\ref.json" ^| findstr /V "object"') do (
    set "BASE_SHA=%%~a"
    set "BASE_SHA=!BASE_SHA: =!"
    set "BASE_SHA=!BASE_SHA:"=!"
)

if "%BASE_SHA%"=="" (
    echo [ERROR] Failed to get base SHA
    set "UPLOAD_SUCCESS=0"
    goto cleanup
)
echo [INFO] Base SHA: %BASE_SHA%

REM Step 2: Get base tree SHA
echo [INFO] Getting base tree...
curl -s -H "Authorization: token %GITHUB_TOKEN%" "%API_BASE%/git/commits/%BASE_SHA%" > "%TEMP_DIR%\commit.json"

for /f "tokens=2 delims=:," %%a in ('findstr /C:"\"sha\"" "%TEMP_DIR%\commit.json"') do (
    set "BASE_TREE=%%~a"
    set "BASE_TREE=!BASE_TREE: =!"
    set "BASE_TREE=!BASE_TREE:"=!"
    goto got_tree
)
:got_tree

if "%BASE_TREE%"=="" (
    echo [ERROR] Failed to get base tree
    set "UPLOAD_SUCCESS=0"
    goto cleanup
)

REM Step 3: Create blobs and build tree
echo [INFO] Creating blobs...
set "TREE_JSON=["
set "FIRST_ENTRY=1"
set "UPLOADED_COUNT=0"

for /L %%i in (1,1,%FILE_COUNT%) do (
    set "CURRENT_FILE=!FILE_%%i!"

    for %%f in ("!CURRENT_FILE!") do set "FILE_NAME=%%~nxf"

    REM Encode file to base64 using PowerShell
    for /f "delims=" %%b in ('powershell -NoProfile -Command "[Convert]::ToBase64String([IO.File]::ReadAllBytes('!CURRENT_FILE!'))"') do set "CONTENT=%%b"

    REM Create blob payload
    echo {"content":"!CONTENT!","encoding":"base64"} > "%TEMP_DIR%\blob_%%i.json"

    REM Create blob
    curl -s -X POST "%API_BASE%/git/blobs" -H "Authorization: token %GITHUB_TOKEN%" -H "Content-Type: application/json" -d @"%TEMP_DIR%\blob_%%i.json" > "%TEMP_DIR%\blob_result_%%i.json"

    for /f "tokens=2 delims=:," %%a in ('findstr /C:"\"sha\"" "%TEMP_DIR%\blob_result_%%i.json"') do (
        set "BLOB_SHA=%%~a"
        set "BLOB_SHA=!BLOB_SHA: =!"
        set "BLOB_SHA=!BLOB_SHA:"=!"
    )

    if not "!BLOB_SHA!"=="" (
        if !FIRST_ENTRY!==0 set "TREE_JSON=!TREE_JSON!,"
        set "TREE_JSON=!TREE_JSON!{\"path\":\"%UPLOAD_DIR%/!FILE_NAME!\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"!BLOB_SHA!\"}"
        set "FIRST_ENTRY=0"
        set /a UPLOADED_COUNT+=1

        REM Save URL
        echo https://raw.githubusercontent.com/%GITHUB_REPOSITORY%/%BRANCH%/%UPLOAD_DIR%/!FILE_NAME! >> UPLOADED_URLS.txt
    )
)

set "TREE_JSON=!TREE_JSON!]"

if %UPLOADED_COUNT%==0 (
    echo [ERROR] No blobs created
    set "UPLOAD_SUCCESS=0"
    goto cleanup
)

REM Step 4: Create tree
echo [INFO] Creating tree...
echo {"base_tree":"%BASE_TREE%","tree":%TREE_JSON%} > "%TEMP_DIR%\tree.json"
curl -s -X POST "%API_BASE%/git/trees" -H "Authorization: token %GITHUB_TOKEN%" -H "Content-Type: application/json" -d @"%TEMP_DIR%\tree.json" > "%TEMP_DIR%\tree_result.json"

for /f "tokens=2 delims=:," %%a in ('findstr /C:"\"sha\"" "%TEMP_DIR%\tree_result.json"') do (
    set "TREE_SHA=%%~a"
    set "TREE_SHA=!TREE_SHA: =!"
    set "TREE_SHA=!TREE_SHA:"=!"
    goto got_new_tree
)
:got_new_tree

if "%TREE_SHA%"=="" (
    echo [ERROR] Failed to create tree
    set "UPLOAD_SUCCESS=0"
    goto cleanup
)

REM Step 5: Create commit
echo [INFO] Creating commit...
echo {"message":"Add %UPLOADED_COUNT% files to %UPLOAD_DIR%","tree":"%TREE_SHA%","parents":["%BASE_SHA%"]} > "%TEMP_DIR%\commit_create.json"
curl -s -X POST "%API_BASE%/git/commits" -H "Authorization: token %GITHUB_TOKEN%" -H "Content-Type: application/json" -d @"%TEMP_DIR%\commit_create.json" > "%TEMP_DIR%\commit_result.json"

for /f "tokens=2 delims=:," %%a in ('findstr /C:"\"sha\"" "%TEMP_DIR%\commit_result.json"') do (
    set "COMMIT_SHA=%%~a"
    set "COMMIT_SHA=!COMMIT_SHA: =!"
    set "COMMIT_SHA=!COMMIT_SHA:"=!"
    goto got_commit
)
:got_commit

if "%COMMIT_SHA%"=="" (
    echo [ERROR] Failed to create commit
    set "UPLOAD_SUCCESS=0"
    goto cleanup
)

REM Step 6: Update branch reference
echo [INFO] Updating branch reference...
echo {"sha":"%COMMIT_SHA%","force":false} > "%TEMP_DIR%\update_ref.json"
curl -s -X PATCH "%API_BASE%/git/refs/heads/%BRANCH%" -H "Authorization: token %GITHUB_TOKEN%" -H "Content-Type: application/json" -d @"%TEMP_DIR%\update_ref.json" > "%TEMP_DIR%\update_result.json"

findstr /C:"\"sha\"" "%TEMP_DIR%\update_result.json" >nul 2>&1
if %ERRORLEVEL%==0 (
    echo [SUCCESS] Uploaded %UPLOADED_COUNT% files to %UPLOAD_DIR%
    set "UPLOAD_SUCCESS=1"
) else (
    echo [ERROR] Failed to update branch reference
    set "UPLOAD_SUCCESS=0"
)

:cleanup
if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%" 2>nul
endlocal & set "UPLOAD_SUCCESS=%UPLOAD_SUCCESS%"
exit /b 0
