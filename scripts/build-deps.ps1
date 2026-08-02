# Build workspace dependencies for a given package.
#
# Reads @viben/* and @yoopta/* workspace dependencies from the target package's
# package.json, then recursively builds any that have a "build" script and
# export from dist/.
#
# Usage: .\scripts\build-deps.ps1 <package-dir> [-Force]
#
#   <package-dir>  Path to the package whose deps should be built (e.g. packages\core)
#   -Force          Rebuild all deps even if dist/ exists

param(
    [Parameter(Mandatory = $false, Position = 0)]
    [string]$PackageDir,

    [switch]$Force
)

# PS 5.1 encoding: aggressively switch to UTF-8 for emoji/CJK display
# Must run BEFORE any console output (including Write-Output)
if ($PSVersionTable.PSVersion.Major -lt 6) {
    $utf8 = New-Object System.Text.UTF8Encoding $true
    [Console]::OutputEncoding = $utf8
    [Console]::InputEncoding = $utf8
    $OutputEncoding = $utf8
    try { & chcp 65001 >$null 2>&1 } catch { }
}

$ErrorActionPreference = "Continue"

# Resolve paths
$RootDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$PackagesDir = Join-Path $RootDir "packages"

if (-not $PackageDir -or -not (Test-Path (Join-Path $PackageDir "package.json"))) {
    Write-Output "Usage: build-deps.ps1 <package-dir> [-Force]"
    exit 1
}

# Normalize to absolute path
$TargetDir = (Resolve-Path $PackageDir).Path

# Track already-built packages (use resolved path as key to avoid basename collisions)
$BuiltSet = [System.Collections.Generic.HashSet[string]]::new()

function Test-IsBuilt {
    param([string]$Key)
    return $BuiltSet.Contains($Key)
}

function Add-Built {
    param([string]$Key)
    [void]$BuiltSet.Add($Key)
}

# Build a single package's workspace deps recursively, then itself
function Build-Package {
    param(
        [string]$PkgDir,
        [string]$RootDir,
        [string]$PackagesDir,
        [switch]$Force
    )

    # Use resolved path as unique key (avoids basename collisions like @viben/ui vs @yoopta/ui)
    $pkgKey = (Resolve-Path $PkgDir).Path

    # Skip if already processed
    if (Test-IsBuilt $pkgKey) {
        return
    }
    Add-Built $pkgKey

    # Extract @viben/* and @yoopta/* workspace deps from package.json
    $pkgJsonPath = Join-Path $PkgDir "package.json"
    $pkgJson = Get-Content $pkgJsonPath -Raw | ConvertFrom-Json

    $allDeps = @{}
    if ($pkgJson.dependencies) {
        $pkgJson.dependencies.PSObject.Properties | ForEach-Object { $allDeps[$_.Name] = $_.Value }
    }
    if ($pkgJson.devDependencies) {
        $pkgJson.devDependencies.PSObject.Properties | ForEach-Object { $allDeps[$_.Name] = $_.Value }
    }

    $workspaceDeps = $allDeps.Keys | Where-Object {
        ($_ -like "@viben/*" -or $_ -like "@yoopta/*") -and $allDeps[$_] -like "workspace:*"
    }

    # Recursively build workspace deps
    foreach ($dep in $workspaceDeps) {
        # Extract package name without scope
        $depName = $dep -replace "^@[^/]+/", ""
        $depDir = Join-Path $PackagesDir $depName
        if (Test-Path $depDir) {
            Build-Package -PkgDir $depDir -RootDir $RootDir -PackagesDir $PackagesDir -Force:$Force
        }
    }

    # Check if this package needs building
    $hasBuild = $false
    $hasDistExport = $false

    if ($pkgJson.scripts -and $pkgJson.scripts.build) {
        $hasBuild = $true
    }

    # PowerShell 5.1 has no ?? operator — use string interpolation to convert $null → ""
    $main = ("$($pkgJson.main)" -replace "^\./", "")
    $module = ("$($pkgJson.module)" -replace "^\./", "")
    if ($main.StartsWith("dist/") -or $module.StartsWith("dist/")) {
        $hasDistExport = $true
    }

    if ($hasBuild -and $hasDistExport) {
        # Determine display name
        $displayName = Split-Path -Leaf $PkgDir
        if ($PkgDir -like "*\packages\*") {
            $displayName = "@viben/$displayName"
        }

        $distDir = Join-Path $PkgDir "dist"
        if ($Force -or -not (Test-Path $distDir)) {
            Write-Output "  📦 Building $displayName..."
            Push-Location $PkgDir
            try {
                $buildOutput = & pnpm build 2>&1
                if ($LASTEXITCODE -ne 0) {
                    Write-Output $buildOutput
                    Write-Error "Build failed for $displayName (exit code $LASTEXITCODE)"
                    exit 1
                }
            }
            finally {
                Pop-Location
            }
        }
        else {
            Write-Output "  ✓ $displayName (dist/ exists)"
        }
    }
}

Write-Output "📦 Checking workspace dependencies..."
Build-Package -PkgDir $TargetDir -RootDir $RootDir -PackagesDir $PackagesDir -Force:$Force
Write-Output "✅ Dependencies ready"
