# One-Liner Install Script — Design Spec

## Overview

Add one-liner install scripts (`install.sh` for macOS/Linux, `install.ps1` for Windows) that automatically detect the environment, install Node.js if missing, install `@viben/kernel` via npm, and launch the setup wizard. This removes the npm knowledge barrier for non-developer users.

**Motivation:** Current installation requires users to know npm (`npm install -g @viben/kernel`). Non-dev users don't know what npm is. Industry standard for CLI tools provides one-liner curl/PowerShell commands that handle everything automatically.

## One-Liner Commands

```bash
# macOS/Linux
curl -fsSL https://raw.githubusercontent.com/Viben/Viben/main/scripts/install.sh | bash

# Windows
powershell -c "irm https://raw.githubusercontent.com/Viben/Viben/main/scripts/install.ps1 | iex"
```

Future: redirect via custom domain (e.g., `viben.dev/install.sh`) when available.

## install.sh (macOS/Linux) — ~800-1000 lines

### Flow

1. **Banner + branding** — ANSI colors, Viben tagline
2. **Detect environment** — OS (Darwin/Linux), arch (x86_64/arm64), downloader (curl/wget)
3. **Bootstrap gum** — Download [charmbracelet/gum](https://github.com/charmbracelet/gum) to temp dir for fancy terminal UI (spinners, confirm dialogs, select menus). Verify SHA256. Fallback to plain text if download fails. Cleaned up on exit.
4. **Parse CLI flags:**
   - `--version <tag>` — npm install target (default: `latest`; use `main` for GitHub main branch)
   - `--install-method npm|git` — npm (default) or clone+build
   - `--no-onboard` — skip running `viben` after install
   - `--dry-run` — print actions without executing
   - `--verify` — verify installation after completion
5. **Choose install method** — Interactive (gum choose) if TTY, default to npm otherwise
6. **Check/install Node.js ≥22:**
   - Detect existing: `node` on PATH, nvm, nodenv, Homebrew, system package
   - If version too old: guide user to upgrade (nvm instructions if nvm detected)
   - If missing: download NodeSource official binary (tar.gz from nodejs.org), verify SHA256, install to user-local path
   - Handle npm prefix/PATH issues (EACCES → setup `~/.npm-global`)
7. **Install @viben/kernel:**
   - **npm method:** `npm install -g @viben/kernel@<version>` with retry logic, log capture on failure
   - **git method:** clone repo, install pnpm, `pnpm install`, `pnpm build`, create wrapper script in `~/.local/bin`
8. **Verify install** — Run `viben --version` to confirm
9. **Post-install:**
   - If TTY available → `exec viben` (launches setup wizard directly)
   - If no TTY → print instruction: `Run 'viben' to complete setup`

### Key Features

- **gum UI:** Spinner animations, colored output, interactive menus via charmbracelet/gum (temp binary, auto-cleaned)
- **SHA256 verification:** Both gum binary and Node.js binary verified via checksums
- **Retry logic:** npm install retries on transient failures
- **sudo detection:** Avoid running as root when not needed, handle EACCES gracefully
- **nvm/nodenv awareness:** Detect managed Node.js, provide upgrade instructions instead of conflicting install
- **Temp file cleanup:** Trap EXIT to clean up all temp files/dirs
- **Non-interactive mode:** Detect piped input, skip interactive prompts, use defaults

## install.ps1 (Windows) — ~300 lines

### Flow

1. **Banner** — ANSI colors (PowerShell escape sequences)
2. **Check/fix execution policy** — Set RemoteSigned for current process if Restricted
3. **Check/install Node.js ≥22:** Try `winget` → `choco` → `scoop` → fail with manual instructions (nodejs.org link)
4. **Check/install Git** — Required for npm; try winget, fail with manual link
5. **Install @viben/kernel** — `npm install -g @viben/kernel` with error handling
6. **PATH setup** — Add npm global bin to user PATH
7. **Post-install** — Run `viben` if TTY, else print instructions

### Parameters

```powershell
param(
    [string]$InstallMethod = "npm",
    [string]$Tag = "latest",
    [string]$GitDir = "$env:USERPROFILE\viben",
    [switch]$NoOnboard,
    [switch]$NoGitUpdate,
    [switch]$DryRun
)
```

No gum on Windows. Plain text with ANSI colors only.

## Config

No config changes required. The install scripts install the existing `@viben/kernel` package which has its own setup wizard.

## Node.js Requirements

- Minimum: Node.js ≥22
- Default install target: Node.js 24 (LTS)
- Version detection parses `node --version` output

## Files

| File | Action |
|------|--------|
| `scripts/install.sh` | New — macOS/Linux one-liner installer |
| `scripts/install.ps1` | New — Windows PowerShell installer |
| `README.md` | Modified — add one-liner Quick Start section above existing npm instructions |
| `docs/` | Modified — add installation guide with all methods |

## Testing

- `--dry-run` flag for testing logic without side effects
- `--verify` flag for post-install verification
- Docker-based testing for install.sh (Ubuntu, Debian, Alpine)
- Manual testing on macOS and Windows PowerShell

## Backward Compatibility

No breaking changes. Existing `npm install -g @viben/kernel` method continues to work. One-liner scripts are an additional installation path that ultimately runs the same npm install.
