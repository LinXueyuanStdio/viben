# Restart Viben Desktop App (Windows PowerShell)
#
# Automatically builds workspace dependencies if dist/ is missing,
# kills all related processes, and restarts the Tauri desktop.
#
# Usage: .\scripts\restart-desktop.ps1

$ErrorActionPreference = "Continue"

$ScriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$DesktopDir  = Join-Path $ProjectRoot "apps\desktop"

# -------------------------------------------------------
# Detect sidecar target triple (Windows x86_64 / arm64)
# -------------------------------------------------------
$arch = (Get-WmiObject Win32_Processor | Select-Object -First 1).Architecture
$targetTriple = switch ($arch) {
    9  { "x86_64-pc-windows-msvc"  }   # x64
    12 { "aarch64-pc-windows-msvc" }   # ARM64
    default { "x86_64-pc-windows-msvc" }
}

$sidecarDir = Join-Path $ProjectRoot "apps\desktop\src-tauri\binaries"
$sidecarBin = Join-Path $sidecarDir "viben-$targetTriple.exe"

# -------------------------------------------------------
# Build workspace dependencies for apps/desktop
# -------------------------------------------------------
# -------------------------------------------------------
# Build workspace dependencies for apps/desktop (skip if already built)
# -------------------------------------------------------
Write-Host "Checking workspace dependencies..."
Set-Location $ProjectRoot
$depsOutput = & pnpm --filter "@viben/core" build 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  @viben/core built successfully"
} else {
    $cliBin = Join-Path $ProjectRoot "packages\core\dist\cli\bin.js"
    if (Test-Path $cliBin) {
        Write-Host "  Using existing @viben/core build"
    } else {
        Write-Host "  Warning: @viben/core build failed and no dist found"
    }
}

# -------------------------------------------------------
# Build sidecar binary if missing
# -------------------------------------------------------
# Always rebuild sidecar to ensure latest TypeScript changes are included
Write-Host "Building sidecar binary (viben-$targetTriple)..."
Set-Location $ProjectRoot
& pnpm --filter "@viben/core" build:sidecar
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to build sidecar binary"
    exit 1
}

# -------------------------------------------------------
# Kill existing desktop-related processes
# -------------------------------------------------------
Write-Host ""
Write-Host "Restarting Viben Desktop..."

Write-Host "  Killing viben-desktop processes..."
& taskkill /IM viben-desktop.exe /F 2>&1 | Out-Null
& taskkill /IM viben.exe /F 2>&1 | Out-Null

Write-Host "  Killing processes on dev ports (1549, 1550)..."
@(1549, 1550) | ForEach-Object {
    $portConns = Get-NetTCPConnection -LocalPort $_ -ErrorAction SilentlyContinue
    if ($portConns) {
        $portConns | Select-Object -ExpandProperty OwningProcess -Unique | Where-Object { $_ -ne 0 } | ForEach-Object {
            & taskkill /PID $_ /F 2>&1 | Out-Null
        }
    }
}

Start-Sleep -Seconds 1
Write-Host "Processes killed, ready to start"

# -------------------------------------------------------
# Start Tauri dev
# -------------------------------------------------------
Write-Host "Starting Tauri desktop..."
Set-Location $DesktopDir
& pnpm tauri dev
