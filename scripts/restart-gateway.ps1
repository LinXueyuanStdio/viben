# Restart Viben Gateway (Windows PowerShell - apps/cli)
#
# Automatically builds workspace dependencies if dist/ is missing,
# then restarts the gateway.
#
# Usage: .\scripts\restart-gateway.ps1 [-Force]
#
#   -Force   Pass --force to `viben gateway restart` AND to build-deps.ps1
#
# Log files (in %USERPROFILE%\.viben\logs\):
#   gateway.log          - Gateway runtime stdout
#   gateway-error.log    - Gateway runtime stderr
#   gateway-restart.log  - Restart script operations log

param(
    [switch]$Force
)

$ErrorActionPreference = "Continue"

$ScriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$CoreDir     = Join-Path $ProjectRoot "packages\core"
$CliDir      = Join-Path $ProjectRoot "apps\cli"
$LogDir      = Join-Path $env:USERPROFILE ".viben\logs"
$RuntimeLog  = Join-Path $LogDir "gateway.log"
$ErrorLog    = Join-Path $LogDir "gateway-error.log"
$RestartLog  = Join-Path $LogDir "gateway-restart.log"
$Port        = 18790
$MaxLogSize  = 10 * 1024 * 1024  # 10MB

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

function Rotate-LogIfNeeded {
    param([string]$LogFile)
    if (Test-Path $LogFile) {
        $fileSize = (Get-Item $LogFile).Length
        if ($fileSize -gt $MaxLogSize) {
            $backupFile = "$LogFile.old"
            Move-Item -Path $LogFile -Destination $backupFile -Force
            Write-Log "INFO" "Rotated log file: $LogFile -> $backupFile"
        }
    }
}

# ============================================================
# Rotate logs
# ============================================================
Rotate-LogIfNeeded $RestartLog
Rotate-LogIfNeeded $RuntimeLog
Rotate-LogIfNeeded $ErrorLog

Add-Content -Path $RestartLog -Value "" -Encoding UTF8
Write-Log "INFO" "=========================================="
Write-Log "INFO" "=== Viben Gateway Restart Started ==="
Write-Log "INFO" "=========================================="
Write-Log "DEBUG" "System: Windows $([System.Environment]::OSVersion.Version)"
Write-Log "DEBUG" "Node version: $(node --version 2>&1)"
Write-Log "DEBUG" "Working directory: $ProjectRoot"

# ============================================================
# Build dependencies and core package
# ============================================================
Write-Log "INFO" "Building @viben/core workspace dependencies..."

# Use build-deps.ps1 for recursive dependency resolution (mirrors build-deps.sh)
$buildDepsScript = Join-Path $ScriptDir "build-deps.ps1"

# Run in-process to avoid sub-process encoding issues on PS 5.1
$depsArgs = @($CoreDir)
if ($Force) { $depsArgs += "-Force" }
# Capture output: stdout (Write-Output) + stderr (Write-Error) for logging
$buildDepsOutput = & $buildDepsScript @depsArgs 2>&1
$buildDepsOutput | ForEach-Object { Add-Content -Path $RestartLog -Value $_ -Encoding UTF8 }
# Show build-deps output (already filtered to key lines by build-deps.ps1 itself)
$buildDepsOutput | ForEach-Object { Write-Host $_ }

if ($LASTEXITCODE -ne 0) {
    Write-Log "ERROR" "Failed to build @viben/core dependencies (exit code $LASTEXITCODE)"
    exit 1
}

# Always rebuild core itself (gateway needs latest code)
Write-Log "INFO" "Rebuilding @viben/core..."
Push-Location $CoreDir
try {
    $buildOutput = & pnpm build 2>&1
    $buildOutput | ForEach-Object { Add-Content -Path $RestartLog -Value $_ -Encoding UTF8 }
    if ($LASTEXITCODE -ne 0) {
        Write-Log "ERROR" "Failed to build @viben/core (exit code $LASTEXITCODE)"
        Write-Log "ERROR" "Last 30 lines of build output:"
        $buildOutput | Select-Object -Last 30 | ForEach-Object { Write-Host $_ }
        exit 1
    }
    # Show summary on success (warnings/errors only, to keep output clean)
    $buildOutput | Where-Object { $_ -match "(error|Error|warning|Warning|ELIFECYCLE)" } | Write-Host
    Write-Log "INFO" "Build successful"
}
finally {
    Pop-Location
}

Write-Log "INFO" "Building viben CLI..."
Push-Location $CliDir
try {
    $buildOutput = & pnpm build 2>&1
    $buildOutput | ForEach-Object { Add-Content -Path $RestartLog -Value $_ -Encoding UTF8 }
    if ($LASTEXITCODE -ne 0) {
        Write-Log "ERROR" "Failed to build viben CLI (exit code $LASTEXITCODE)"
        Write-Log "ERROR" "Last 30 lines of build output:"
        $buildOutput | Select-Object -Last 30 | ForEach-Object { Write-Host $_ }
        exit 1
    }
    Write-Log "INFO" "CLI build successful"
}
finally {
    Pop-Location
}

# npm link (non-fatal)
Write-Log "INFO" "Linking viben CLI..."
Push-Location $CliDir
try {
    & npm link 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Log "WARN" "npm link failed (non-fatal)" }
}
finally {
    Pop-Location
}

# ============================================================
# Stop existing gateway processes
# ============================================================
Write-Log "INFO" "Stopping existing gateway processes..."

function Stop-MatchingProcesses {
    param([string]$Pattern, [string]$EmptyMessage)

    $matches = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
        $_.CommandLine -and $_.CommandLine -match $Pattern
    }

    if ($matches) {
        foreach ($proc in $matches) {
            Write-Log "INFO" "Killing process matching '$Pattern' (PID $($proc.ProcessId))"
            Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
        }
        Start-Sleep -Milliseconds 500
    }
    else {
        Write-Log "DEBUG" $EmptyMessage
    }
}

Stop-MatchingProcesses "viben.*gateway.*start" "No viben gateway process found"
Stop-MatchingProcesses "packages[\\/]+core.*gateway.*start" "No node gateway process found"
Stop-MatchingProcesses "apps[\\/]+cli.*gateway.*start" "No apps/cli gateway process found"

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

# ============================================================
# Start gateway
# ============================================================
$cliBin = Join-Path $CliDir "dist\index.js"
if (-not (Test-Path $cliBin)) {
    Write-Log "ERROR" "CLI binary not found after build: $cliBin"
    exit 1
}

$nodeArgs = @(".\dist\index.js", "gateway", "restart", "--port", "$Port")
if ($Force) { $nodeArgs += "--force" }

Write-Log "INFO" "Starting Node.js gateway on port $Port...$(if ($Force) { ' (force mode)' })"
Write-Log "DEBUG" "Command: node $($nodeArgs -join ' ')"

# Clear previous runtime logs
Set-Content -Path $RuntimeLog -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') Gateway starting..." -Encoding UTF8
Set-Content -Path $ErrorLog -Value "" -Encoding UTF8

# Start gateway using .NET Process API to properly disconnect stdin.
# Start-Process inherits parent's stdin by default, which causes the gateway
# process to steal keyboard input from the terminal.
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "node"
$psi.Arguments = $nodeArgs -join ' '
$psi.WorkingDirectory = $CliDir
$psi.UseShellExecute = $false          # Required for stream redirection
$psi.RedirectStandardInput = $true     # Disconnect from parent's stdin
$psi.RedirectStandardOutput = $true    # Capture stdout -> log file
$psi.RedirectStandardError = $true     # Capture stderr -> log file
$psi.CreateNoWindow = $true

$proc = New-Object System.Diagnostics.Process
$proc.StartInfo = $psi
$proc.Start() | Out-Null

# Close stdin immediately so the process never steals console input
$proc.StandardInput.Close()

# Begin async read of stdout/stderr to prevent buffer deadlocks
$stdoutTask = $proc.StandardOutput.ReadToEndAsync()
$stderrTask = $proc.StandardError.ReadToEndAsync()

# ============================================================
# Wait for gateway health endpoint
# ============================================================
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
    }
    catch { }
    $retryCount++
    Write-Log "DEBUG" "Retry $retryCount/$maxRetries - waiting for gateway..."
}

if ($started) {
    # Get gateway PID
    $gatewayPid = (Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess

    Write-Log "INFO" "=========================================="
    Write-Log "INFO" "Gateway started successfully!"
    Write-Log "INFO" "=========================================="
    Write-Log "INFO" "PID: $gatewayPid"
    Write-Log "INFO" "Health:      http://127.0.0.1:$Port/health"
    Write-Log "INFO" "API:         http://127.0.0.1:$Port/api"
    Write-Log "INFO" "Runtime Log: $RuntimeLog"
    Write-Log "INFO" "Error Log:   $ErrorLog"
    Write-Log "INFO" "Restart Log: $RestartLog"

    # Log health check response
    try {
        $healthResp = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        Write-Log "DEBUG" "Health response: $($healthResp.Content)"
    }
    catch { }

    exit 0
}
else {
    Write-Log "ERROR" "=========================================="
    Write-Log "ERROR" "Gateway failed to start after $maxRetries retries"
    Write-Log "ERROR" "=========================================="

    # Diagnostics
    Write-Log "ERROR" "Diagnostics:"

    # Check port status
    $portCheck = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($portCheck) {
        Write-Log "DEBUG" "Something is listening on port $Port but not responding to health check"
    }
    else {
        Write-Log "ERROR" "Nothing is listening on port $Port"
    }

    # Show last log lines from both stdout and stderr logs
    Write-Log "ERROR" "Last 50 lines of runtime log (stdout):"
    Add-Content -Path $RestartLog -Value "--- Runtime Log Start ---" -Encoding UTF8
    if (Test-Path $RuntimeLog) {
        Get-Content $RuntimeLog -Tail 50 -ErrorAction SilentlyContinue | ForEach-Object {
            Write-Host $_
            Add-Content -Path $RestartLog -Value $_ -Encoding UTF8
        }
    }
    else {
        Write-Host "(no log output)"
    }
    Add-Content -Path $RestartLog -Value "--- Runtime Log End ---" -Encoding UTF8

    Write-Log "ERROR" "Last 20 lines of error log (stderr):"
    Add-Content -Path $RestartLog -Value "--- Error Log Start ---" -Encoding UTF8
    if (Test-Path $ErrorLog) {
        Get-Content $ErrorLog -Tail 20 -ErrorAction SilentlyContinue | ForEach-Object {
            Write-Host $_
            Add-Content -Path $RestartLog -Value $_ -Encoding UTF8
        }
    }
    else {
        Write-Host "(no error output)"
    }
    Add-Content -Path $RestartLog -Value "--- Error Log End ---" -Encoding UTF8

    exit 1
}
