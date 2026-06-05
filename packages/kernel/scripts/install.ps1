# Viben Installer for Windows
# Usage: powershell -c "irm https://raw.githubusercontent.com/Viben/Viben/main/scripts/install.ps1 | iex"

[CmdletBinding()]
param(
    [ValidateSet('npm', 'git')]
    [string]$InstallMethod = 'npm',

    [string]$Tag = 'latest',

    [string]$GitDir = "$env:USERPROFILE\Viben",

    [switch]$NoOnboard,

    [switch]$NoGitUpdate,

    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

# ─── Section 1: ANSI Colors & Utilities ──────────────────────────────────────

$ESC = [char]27
$BOLD      = "$ESC[1m"
$ACCENT    = "$ESC[38;2;99;102;241m"     # indigo #6366f1
$SUCCESS_C = "$ESC[38;2;34;197;94m"      # green #22c55e
$WARN_C    = "$ESC[38;2;250;204;21m"     # yellow #facc15
$ERROR_C   = "$ESC[38;2;239;68;68m"      # red #ef4444
$MUTED     = "$ESC[38;2;90;100;128m"     # text-muted #5a6480
$NC        = "$ESC[0m"

$INSTALLER_VERSION = "1.0.1"

$NODE_MIN_MAJOR = 20

function Write-Msg {
    param(
        [ValidateSet('info', 'success', 'warn', 'error')]
        [string]$Level = 'info',
        [string]$Message
    )
    switch ($Level) {
        'info'    { Write-Host "${MUTED}i${NC} $Message" }
        'success' { Write-Host "${SUCCESS_C}${BOLD}v${NC} $Message" }
        'warn'    { Write-Host "${WARN_C}!${NC} $Message" }
        'error'   { Write-Host "${ERROR_C}x${NC} $Message" }
    }
}

function Write-Banner {
    Write-Host ""
    Write-Host "${ACCENT}${BOLD}  Viben Installer${NC}"
    Write-Host "${MUTED}  AI coding agents, anywhere.${NC}"
    Write-Host "${MUTED}  installer v$INSTALLER_VERSION${NC}"
    Write-Host ""
}

# ─── Section 2: Execution Policy ─────────────────────────────────────────────

function Ensure-ExecutionPolicy {
    $current = Get-ExecutionPolicy -Scope Process
    if ($current -eq 'Restricted' -or $current -eq 'AllSigned') {
        Write-Msg -Level info -Message "Setting execution policy to RemoteSigned for this process..."
        if (-not $DryRun) {
            Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned -Force
        }
        Write-Msg -Level success -Message "Execution policy set to RemoteSigned (process scope)"
    } else {
        Write-Msg -Level success -Message "Execution policy OK ($current)"
    }
}

# ─── Section 3: Node.js Detection & Installation ─────────────────────────────

function Get-NodeMajor {
    try {
        $ver = & node -v 2>$null
        if ($ver -match '^v(\d+)') {
            return [int]$Matches[1]
        }
    } catch {}
    return $null
}

function Ensure-Node {
    $major = Get-NodeMajor
    if ($null -ne $major -and $major -ge $NODE_MIN_MAJOR) {
        Write-Msg -Level success -Message "Node.js v$major found (>= $NODE_MIN_MAJOR required)"
        return
    }

    if ($null -ne $major) {
        Write-Msg -Level warn -Message "Node.js v$major found but v$NODE_MIN_MAJOR+ required"
    } else {
        Write-Msg -Level warn -Message "Node.js not found"
    }

    Write-Msg -Level info -Message "Attempting to install Node.js..."

    # Try winget
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Write-Msg -Level info -Message "Installing Node.js via winget..."
        if (-not $DryRun) {
            $result = & winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements 2>&1
            # Refresh PATH
            $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path', 'User')
            $major = Get-NodeMajor
            if ($null -ne $major -and $major -ge $NODE_MIN_MAJOR) {
                Write-Msg -Level success -Message "Node.js v$major installed via winget"
                return
            }
        } else {
            Write-Msg -Level info -Message "[dry-run] Would install Node.js via winget"
            return
        }
    }

    # Try choco
    if (Get-Command choco -ErrorAction SilentlyContinue) {
        Write-Msg -Level info -Message "Installing Node.js via Chocolatey..."
        if (-not $DryRun) {
            & choco install nodejs-lts -y 2>&1 | Out-Null
            $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path', 'User')
            $major = Get-NodeMajor
            if ($null -ne $major -and $major -ge $NODE_MIN_MAJOR) {
                Write-Msg -Level success -Message "Node.js v$major installed via Chocolatey"
                return
            }
        } else {
            Write-Msg -Level info -Message "[dry-run] Would install Node.js via Chocolatey"
            return
        }
    }

    # Try scoop
    if (Get-Command scoop -ErrorAction SilentlyContinue) {
        Write-Msg -Level info -Message "Installing Node.js via scoop..."
        if (-not $DryRun) {
            & scoop install nodejs-lts 2>&1 | Out-Null
            $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path', 'User')
            $major = Get-NodeMajor
            if ($null -ne $major -and $major -ge $NODE_MIN_MAJOR) {
                Write-Msg -Level success -Message "Node.js v$major installed via scoop"
                return
            }
        } else {
            Write-Msg -Level info -Message "[dry-run] Would install Node.js via scoop"
            return
        }
    }

    Write-Msg -Level error -Message "Could not install Node.js automatically."
    Write-Msg -Level error -Message "Please install Node.js >= $NODE_MIN_MAJOR from https://nodejs.org/ and re-run."
    exit 1
}

# ─── Section 4: Git Detection & Installation ─────────────────────────────────

function Ensure-Git {
    if (Get-Command git -ErrorAction SilentlyContinue) {
        Write-Msg -Level success -Message "Git found"
        return
    }

    if ($InstallMethod -eq 'npm') {
        # Git not strictly required for npm install
        return
    }

    Write-Msg -Level warn -Message "Git not found"
    Write-Msg -Level info -Message "Attempting to install Git..."

    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Write-Msg -Level info -Message "Installing Git via winget..."
        if (-not $DryRun) {
            & winget install Git.Git --accept-source-agreements --accept-package-agreements 2>&1 | Out-Null
            $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path', 'User')
            if (Get-Command git -ErrorAction SilentlyContinue) {
                Write-Msg -Level success -Message "Git installed via winget"
                return
            }
        } else {
            Write-Msg -Level info -Message "[dry-run] Would install Git via winget"
            return
        }
    }

    Write-Msg -Level error -Message "Could not install Git automatically."
    Write-Msg -Level error -Message "Please install Git from https://git-scm.com/ and re-run."
    exit 1
}

# ─── Section 5: Resolve Package Install Spec ─────────────────────────────────

function Resolve-PackageInstallSpec {
    param([string]$RequestedTag)

    if ($RequestedTag -eq 'latest') {
        return "@viben/kernel@latest"
    }
    # If it looks like a version number, use it directly
    if ($RequestedTag -match '^\d') {
        return "@viben/kernel@$RequestedTag"
    }
    # Treat as dist-tag
    return "@viben/kernel@$RequestedTag"
}

function Resolve-NpmExecutable {
    # Node for Windows ships npm.ps1, which rebuilds argv via PowerShell's parser. Scoped package
    # names (@scope/pkg) break that and npm may report Unknown command "pm". npm.cmd calls node
    # directly and does not have this bug.
    $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
    if ($nodeCmd -and $nodeCmd.Source) {
        $npmCmd = Join-Path (Split-Path -Parent $nodeCmd.Source) 'npm.cmd'
        if (Test-Path -LiteralPath $npmCmd) {
            return $npmCmd
        }
    }
    return 'npm'
}

# ─── Section 6: Install via npm ──────────────────────────────────────────────

function Install-VibenNpm {
    $npmExe = Resolve-NpmExecutable
    $spec = Resolve-PackageInstallSpec -RequestedTag $Tag
    Write-Msg -Level info -Message "Installing $spec globally via npm..."

    if ($DryRun) {
        Write-Msg -Level info -Message "[dry-run] Would run: npm install -g -- `"$spec`""
        return
    }

    $maxRetries = 3
    $retryDelay = 2
    $attempt = 0
    $lastOutput = ""

    while ($attempt -lt $maxRetries) {
        $attempt++
        try {
            $lastOutput = & $npmExe install -g -- "$spec" 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Msg -Level success -Message "Installed $spec via npm"
                return
            }
            if ($attempt -lt $maxRetries) {
                Write-Msg -Level warn -Message "npm install failed (attempt $attempt/$maxRetries), retrying in ${retryDelay}s..."
                Start-Sleep -Seconds $retryDelay
            }
        } catch {
            $lastOutput = "$_"
            if ($attempt -lt $maxRetries) {
                Write-Msg -Level warn -Message "npm install error (attempt $attempt/$maxRetries): $_ - retrying in ${retryDelay}s..."
                Start-Sleep -Seconds $retryDelay
            }
        }
    }

    Write-Msg -Level error -Message "npm install failed after $maxRetries attempts:"
    Write-Host $lastOutput
    exit 1
}

# ─── Section 7: Install via Git ──────────────────────────────────────────────

function Install-VibenGit {
    $repoUrl = "https://github.com/LinXueyuanStdio/viben.git"

    if ($DryRun) {
        Write-Msg -Level info -Message "[dry-run] Would clone $repoUrl to $GitDir, install deps, build, and create wrapper"
        return
    }

    # Clone or update
    if (Test-Path (Join-Path $GitDir '.git')) {
        if (-not $NoGitUpdate) {
            Write-Msg -Level info -Message "Updating existing checkout at $GitDir..."
            Push-Location $GitDir
            try {
                & git pull --ff-only 2>&1 | Out-Null
                if ($LASTEXITCODE -ne 0) {
                    Write-Msg -Level warn -Message "git pull failed, continuing with existing checkout"
                }
            } finally {
                Pop-Location
            }
        } else {
            Write-Msg -Level info -Message "Skipping git pull (--NoGitUpdate)"
        }
    } else {
        Write-Msg -Level info -Message "Cloning $repoUrl to $GitDir..."
        & git clone $repoUrl $GitDir 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Msg -Level error -Message "git clone failed"
            exit 1
        }
    }

    # Checkout tag if not latest
    if ($Tag -ne 'latest') {
        Push-Location $GitDir
        try {
            & git checkout "v$Tag" 2>&1 | Out-Null
            if ($LASTEXITCODE -ne 0) {
                & git checkout $Tag 2>&1 | Out-Null
            }
        } finally {
            Pop-Location
        }
    }

    # Install dependencies (prefer pnpm)
    Push-Location $GitDir
    try {
        $pm = 'npm'
        if (Get-Command pnpm -ErrorAction SilentlyContinue) {
            $pm = 'pnpm'
        } elseif (Get-Command corepack -ErrorAction SilentlyContinue) {
            Write-Msg -Level info -Message "Enabling corepack for pnpm..."
            & corepack enable 2>&1 | Out-Null
            if (Get-Command pnpm -ErrorAction SilentlyContinue) {
                $pm = 'pnpm'
            }
        }

        Write-Msg -Level info -Message "Installing dependencies with $pm..."
        & $pm install 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Msg -Level error -Message "$pm install failed"
            exit 1
        }

        Write-Msg -Level info -Message "Building..."
        & $pm run build 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Msg -Level error -Message "Build failed"
            exit 1
        }
    } finally {
        Pop-Location
    }

    # Create wrapper .cmd in a directory we can add to PATH
    $binDir = Join-Path $env:USERPROFILE '.viben' 'bin'
    if (-not (Test-Path $binDir)) {
        New-Item -ItemType Directory -Path $binDir -Force | Out-Null
    }

    $wrapperPath = Join-Path $binDir 'viben.cmd'
    $cliEntry = Join-Path $GitDir 'dist' 'cli.js'
    @"
@echo off
node "$cliEntry" %*
"@ | Set-Content -Path $wrapperPath -Encoding ASCII

    Write-Msg -Level success -Message "Built from source and created wrapper at $wrapperPath"
}

# ─── Section 8: PATH Management ──────────────────────────────────────────────

function Add-ToPath {
    param([string]$Dir)

    if (-not $Dir) { return }
    if (-not (Test-Path $Dir)) { return }

    # Check if already in PATH (guard against null PATH on fresh installs)
    $currentPath = [System.Environment]::GetEnvironmentVariable('Path', 'User')
    if ($null -eq $currentPath) { $currentPath = '' }
    if (($currentPath -split ';') -contains $Dir) {
        Write-Msg -Level info -Message "$Dir already in PATH"
        return
    }

    if ($DryRun) {
        Write-Msg -Level info -Message "[dry-run] Would add $Dir to user PATH"
        return
    }

    $newPath = if ($currentPath) { "$currentPath;$Dir" } else { $Dir }
    [System.Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
    $env:Path = "$env:Path;$Dir"
    Write-Msg -Level success -Message "Added $Dir to user PATH"
}

# ─── Section 9: Main ─────────────────────────────────────────────────────────

function Main {
    Write-Banner

    # Stage 1: Environment
    Write-Host "${ACCENT}${BOLD}[1/3] Checking environment${NC}"
    Ensure-ExecutionPolicy
    Ensure-Node
    Ensure-Git

    # Stage 2: Install
    Write-Host ""
    Write-Host "${ACCENT}${BOLD}[2/3] Installing Viben ($InstallMethod)${NC}"

    if ($InstallMethod -eq 'npm') {
        Install-VibenNpm

        # Refresh PATH after npm global install
        $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path', 'User')

        # Find npm global bin and ensure it's in user PATH
        $npmExe = Resolve-NpmExecutable
        try {
            $npmPrefix = (& $npmExe prefix -g 2>$null).Trim()
            if ($npmPrefix) {
                Add-ToPath -Dir $npmPrefix
            }
        } catch {}
    } else {
        Install-VibenGit

        $binDir = Join-Path $env:USERPROFILE '.viben' 'bin'
        Add-ToPath -Dir $binDir
    }

    # Stage 3: Verify & celebrate
    Write-Host ""
    Write-Host "${ACCENT}${BOLD}[3/3] Finishing up${NC}"

    # Refresh PATH one more time
    $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path', 'User')

    $viben = Get-Command viben -ErrorAction SilentlyContinue
    if (-not $viben) {
        # Also check npm global prefix directly
        try {
            $npmForPrefix = Resolve-NpmExecutable
            $npmPrefix = (& $npmForPrefix prefix -g 2>$null).Trim()
            if ($npmPrefix -and (Test-Path (Join-Path $npmPrefix 'viben.cmd'))) {
                $env:Path = "$env:Path;$npmPrefix"
                Add-ToPath -Dir $npmPrefix
                $viben = Get-Command viben -ErrorAction SilentlyContinue
            }
        } catch {}
    }

    Write-Host ""
    Write-Host "${SUCCESS_C}${BOLD}  Viben installed successfully!${NC}"
    Write-Host ""

    if ($viben -and -not $DryRun) {
        $ver = & viben --version 2>$null
        if ($ver) {
            Write-Msg -Level info -Message "Version: $ver"
        }
        Write-Host ""

        if (-not $NoOnboard) {
            Write-Msg -Level info -Message "Launching Viben..."
            & viben
        } else {
            Write-Host "  Run ${ACCENT}viben${NC} to get started."
        }
    } else {
        Write-Host "  You may need to restart your terminal, then run ${ACCENT}viben${NC} to get started."
    }

    Write-Host ""
}

# ─── Entry Point ──────────────────────────────────────────────────────────────

Main
