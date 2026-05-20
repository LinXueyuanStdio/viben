# Restart Viben Gateway (Windows PowerShell)
#
# Usage: .\scripts\restart-gateway.ps1 [-Force]
#
#   -Force   Pass --force to `viben gateway restart`
#
# Log files (in %USERPROFILE%\.viben\logs\):
#   gateway.log          - Gateway runtime output
#   gateway-restart.log  - Restart script operations log

param(
    [switch]$Force
)

$ErrorActionPreference = "Continue"

$ScriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$CoreDir     = Join-Path $ProjectRoot "packages\core"
$LogDir      = Join-Path $env:USERPROFILE ".viben\logs"
$RuntimeLog  = Join-Path $LogDir "gateway.log"
$RestartLog  = Join-Path $LogDir "gateway-restart.log"
$Port        = 18790

# Ensure log directory exists
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }

function Write-Log {
    param([string]$Level, [string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$timestamp] [$Level] $Message"
    switch ($Level) {
        "ERROR" { Write-Host $line -ForegroundColor Red }
        "WARN"  { Write-Host $line -ForegroundColor Yellow }
        "DEBUG" { Write-Host $line -ForegroundColor Cyan }
        default { Write-Host $line -ForegroundColor Green }
    }
    Add-Content -Path $RestartLog -Value $line -Encoding UTF8
}

Add-Content -Path $RestartLog -Value "" -Encoding UTF8
Write-Log "INFO" "=========================================="
Write-Log "INFO" "=== Viben Gateway Restart Started ==="
Write-Log "INFO" "=========================================="
Write-Log "DEBUG" "Node version: $(node --version 2>$null)"
Write-Log "DEBUG" "Working directory: $ProjectRoot"

# -------------------------------------------------------
# Build @viben/core
# -------------------------------------------------------
Write-Log "INFO" "Building @viben/core..."
Set-Location $ProjectRoot
$buildOutput = & pnpm --filter "@viben/core" build 2>&1
$buildOutput | ForEach-Object { Add-Content -Path $RestartLog -Value $_ -Encoding UTF8 }
$buildOutput | Where-Object { $_ -match "(✓|📦|error|Error|warning|Warning)" } | Write-Host
if ($LASTEXITCODE -ne 0) {
    $cliBinCheck = Join-Path $CoreDir "dist\cli\bin.js"
    if (Test-Path $cliBinCheck) {
        Write-Log "WARN" "Build exited with code $LASTEXITCODE but dist/cli/bin.js exists — continuing with existing build"
    } else {
        Write-Log "ERROR" "Failed to build @viben/core (exit code $LASTEXITCODE) and no dist found"
        exit 1
    }
} else {
    Write-Log "INFO" "Build successful"
}

# npm link (non-fatal)
Write-Log "INFO" "Linking viben CLI..."
Set-Location $CoreDir
& npm link 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Log "WARN" "npm link failed (non-fatal)" }

# -------------------------------------------------------
# Stop existing gateway processes on port $Port
# -------------------------------------------------------
Write-Log "INFO" "Stopping existing gateway processes..."

# Kill by process name (node gateway, viben sidecar)
@("node", "viben") | ForEach-Object {
    Get-Process -Name $_ -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Log "INFO" "Killing $($_.Name) (PID $($_.Id))"
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    }
}

# Kill any remaining processes that own the port (handles SYSTEM/service processes)
$connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
if ($connections) {
    $owningPids = $connections | Select-Object -ExpandProperty OwningProcess -Unique | Where-Object { $_ -ne 0 }
    foreach ($procId in $owningPids) {
        Write-Log "INFO" "Killing PID $procId on port $Port via taskkill"
        & taskkill /PID $procId /F 2>&1 | Out-Null
    }
    Start-Sleep -Milliseconds 800
}

# Verify port is free
$stillBusy = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
if ($stillBusy) {
    Write-Log "ERROR" "Failed to free port $Port"
    exit 1
}
Write-Log "INFO" "Port $Port is free"

# -------------------------------------------------------
# Start gateway
# -------------------------------------------------------
Set-Location $CoreDir
$cliBin = Join-Path $CoreDir "dist\cli\bin.js"
if (-not (Test-Path $cliBin)) {
    Write-Log "ERROR" "CLI binary not found after build: $cliBin"
    exit 1
}

$nodeArgs = @(".\dist\cli\bin.js", "gateway", "restart", "--port", "$Port")
if ($Force) { $nodeArgs += "--force" }

Write-Log "INFO" "Starting Node.js gateway on port $Port...$(if ($Force) { ' (force mode)' })"
Write-Log "DEBUG" "Command: node $($nodeArgs -join ' ')"

# Clear runtime log
Set-Content -Path $RuntimeLog -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') Gateway starting..." -Encoding UTF8

Start-Process -FilePath "node" -ArgumentList $nodeArgs -WorkingDirectory $CoreDir -WindowStyle Hidden

# -------------------------------------------------------
# Wait for gateway health endpoint
# -------------------------------------------------------
Write-Log "INFO" "Waiting for gateway to start..."
$maxRetries = 15
$retryCount = 0
$started    = $false

while ($retryCount -lt $maxRetries) {
    Start-Sleep -Seconds 1
    try {
        $resp = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        if ($resp.StatusCode -eq 200) {
            $started = $true
            break
        }
    } catch { }
    $retryCount++
    Write-Log "DEBUG" "Retry $retryCount/$maxRetries - waiting for gateway..."
}

if ($started) {
    Write-Log "INFO" "=========================================="
    Write-Log "INFO" "Gateway started successfully!"
    Write-Log "INFO" "=========================================="
    Write-Log "INFO" "Health:      http://127.0.0.1:$Port/health"
    Write-Log "INFO" "API:         http://127.0.0.1:$Port/api"
    Write-Log "INFO" "Runtime Log: $RuntimeLog"
    Write-Log "INFO" "Restart Log: $RestartLog"
    exit 0
} else {
    Write-Log "ERROR" "=========================================="
    Write-Log "ERROR" "Gateway failed to start after $maxRetries retries"
    Write-Log "ERROR" "=========================================="
    Write-Log "ERROR" "Check runtime log: $RuntimeLog"
    exit 1
}
