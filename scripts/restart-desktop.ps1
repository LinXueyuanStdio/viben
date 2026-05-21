# Restart Viben Desktop App (Windows PowerShell)
#
# Automatically builds workspace dependencies if dist/ is missing,
# kills all related processes, and restarts the Tauri desktop.
#
# Usage: .\scripts\restart-desktop.ps1

$ErrorActionPreference = "Stop"

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
Write-Host "Checking workspace dependencies..."
Set-Location $ProjectRoot

# Build dependencies recursively (equivalent to build-deps.sh)
$packagesDir = Join-Path $ProjectRoot "packages"
$yooptaDir = Join-Path $ProjectRoot "infra\Yoopta-Editor\packages"

# Get desktop package.json deps
$desktopPkgJson = Get-Content (Join-Path $DesktopDir "package.json") | ConvertFrom-Json
$allDeps = @{}
if ($desktopPkgJson.dependencies) { $desktopPkgJson.dependencies.PSObject.Properties | ForEach-Object { $allDeps[$_.Name] = $_.Value } }
if ($desktopPkgJson.devDependencies) { $desktopPkgJson.devDependencies.PSObject.Properties | ForEach-Object { $allDeps[$_.Name] = $_.Value } }

# Build @viben/* workspace deps
$vibenDeps = $allDeps.Keys | Where-Object { $_ -like "@viben/*" -and $allDeps[$_] -like "workspace:*" }
foreach ($dep in $vibenDeps) {
    $depName = $dep -replace "@viben/", ""
    $depDir = Join-Path $packagesDir $depName
    if (Test-Path $depDir) {
        $distDir = Join-Path $depDir "dist"
        if (-not (Test-Path $distDir)) {
            Write-Host "  Building $dep..."
            & pnpm --filter $dep build
        } else {
            Write-Host "  $dep (dist/ exists)"
        }
    }
}

# Build @yoopta/* workspace deps
$yooptaDeps = $allDeps.Keys | Where-Object { $_ -like "@yoopta/*" -and $allDeps[$_] -like "workspace:*" }
foreach ($dep in $yooptaDeps) {
    $depName = $dep -replace "@yoopta/", ""
    # Try core/, plugins/, themes/, marks
    $possiblePaths = @(
        (Join-Path $yooptaDir "core\$depName"),
        (Join-Path $yooptaDir "plugins\$depName"),
        (Join-Path $yooptaDir "themes\$depName")
    )
    if ($depName -eq "marks") { $possiblePaths += Join-Path $yooptaDir "marks" }
    if ($depName -eq "themes-shadcn") { $possiblePaths += Join-Path $yooptaDir "themes\shadcn" }

    foreach ($depDir in $possiblePaths) {
        if (Test-Path $depDir) {
            $distDir = Join-Path $depDir "dist"
            if (-not (Test-Path $distDir)) {
                Write-Host "  Building $dep..."
                & pnpm --filter $dep build
            } else {
                Write-Host "  $dep (dist/ exists)"
            }
            break
        }
    }
}

Write-Host "Dependencies ready"

# -------------------------------------------------------
# Build sidecar binary if missing (skip if exists)
# -------------------------------------------------------
if (-not (Test-Path $sidecarBin)) {
    Write-Host "Building sidecar binary (viben-$targetTriple)..."
    Set-Location $ProjectRoot
    & pnpm --filter "@viben/core" build:sidecar
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to build sidecar binary"
        exit 1
    }
} else {
    Write-Host "Sidecar binary exists: viben-$targetTriple"
}

# -------------------------------------------------------
# Kill existing desktop-related processes
# -------------------------------------------------------
Write-Host ""
Write-Host "Restarting Viben Desktop..."

Write-Host "  Killing viben-desktop processes..."
Get-Process -Name "viben-desktop" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name "viben" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# Pattern-based killing (similar to pkill -f)
Write-Host "  Killing desktop-related Vite/Tauri processes..."
Get-Process | Where-Object { $_.CommandLine -like "*apps/desktop*vite*" -or $_.CommandLine -like "*apps\desktop*vite*" } | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process | Where-Object { $_.CommandLine -like "*tauri*apps/desktop*" -or $_.CommandLine -like "*tauri*apps\desktop*" } | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process | Where-Object { $_.CommandLine -like "*cargo*viben-desktop*" } | Stop-Process -Force -ErrorAction SilentlyContinue

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

# -------------------------------------------------------
# Verify ports are free
# -------------------------------------------------------
$portsInUse = @()
@(1549, 1550) | ForEach-Object {
    if (Get-NetTCPConnection -LocalPort $_ -ErrorAction SilentlyContinue) {
        $portsInUse += $_
    }
}

if ($portsInUse.Count -gt 0) {
    Write-Error "Error: Ports still in use: $($portsInUse -join ', ')"
    exit 1
}

Write-Host "All processes killed, ports 1549/1550 are free"

# -------------------------------------------------------
# Start Tauri dev
# -------------------------------------------------------
Write-Host "Starting Tauri desktop..."
Set-Location $DesktopDir
& pnpm tauri dev
