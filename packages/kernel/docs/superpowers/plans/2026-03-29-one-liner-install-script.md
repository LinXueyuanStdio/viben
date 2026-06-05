# One-Liner Install Script Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `install.sh` (macOS/Linux) and `install.ps1` (Windows) one-liner install scripts that auto-detect environment, install Node.js if missing, install `@viben/kernel` via npm, and launch the setup wizard.

**Architecture:** Two standalone scripts (no shared code between them). `install.sh` uses charmbracelet/gum for fancy UI with plain-text fallback. `install.ps1` uses ANSI escape sequences only. Both follow the same flow: detect → install deps → install CLI → launch.

**Tech Stack:** Bash (install.sh), PowerShell (install.ps1), charmbracelet/gum 0.17.0, Node.js ≥22, npm

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `scripts/install.sh` | New | macOS/Linux installer (~800-1000 lines) |
| `scripts/install.ps1` | New | Windows PowerShell installer (~300 lines) |
| `README.md` | Modify | Add one-liner Quick Start above existing npm instructions |

---

## Task 1: install.sh — Initialization & Utilities (~Lines 1-140)

**Files:**
- Create: `scripts/install.sh`

- [ ] **Step 1: Create install.sh with shebang, strict mode, and global variables**

```bash
#!/bin/bash
set -euo pipefail

# Viben Installer for macOS and Linux
# Usage: curl -fsSL https://raw.githubusercontent.com/Viben/Viben/main/scripts/install.sh | bash

BOLD='\033[1m'
ACCENT='\033[38;2;99;102;241m'       # indigo #6366f1
INFO='\033[38;2;136;146;176m'        # text-secondary
SUCCESS='\033[38;2;34;197;94m'       # green #22c55e
WARN='\033[38;2;250;204;21m'         # yellow #facc15
ERROR='\033[38;2;239;68;68m'         # red #ef4444
MUTED='\033[38;2;90;100;128m'        # text-muted
NC='\033[0m'

DEFAULT_TAGLINE="Bridge AI agents to your chat."
NODE_DEFAULT_MAJOR=24
NODE_MIN_MAJOR=22
NODE_MIN_MINOR=0
NODE_MIN_VERSION="${NODE_MIN_MAJOR}.${NODE_MIN_MINOR}"

ORIGINAL_PATH="${PATH:-}"

TMPFILES=()
cleanup_tmpfiles() {
    local f
    for f in "${TMPFILES[@]:-}"; do
        rm -rf "$f" 2>/dev/null || true
    done
}
trap cleanup_tmpfiles EXIT

mktempfile() {
    local f
    f="$(mktemp)"
    TMPFILES+=("$f")
    echo "$f"
}

mktempdir() {
    local d
    d="$(mktemp -d)"
    TMPFILES+=("$d")
    echo "$d"
}
```

Reference: see `_ignore/openclaw/scripts/` — lines 1-40 for exact pattern.

- [ ] **Step 2: Add downloader detection and download helpers**

```bash
DOWNLOADER=""
detect_downloader() {
    if command -v curl &> /dev/null; then
        DOWNLOADER="curl"
        return 0
    fi
    if command -v wget &> /dev/null; then
        DOWNLOADER="wget"
        return 0
    fi
    ui_error "Missing downloader (curl or wget required)"
    exit 1
}

download_file() {
    local url="$1"
    local output="$2"
    if [[ -z "$DOWNLOADER" ]]; then
        detect_downloader
    fi
    if [[ "$DOWNLOADER" == "curl" ]]; then
        curl -fsSL --proto '=https' --tlsv1.2 --retry 3 --retry-delay 1 --retry-connrefused -o "$output" "$url"
        return
    fi
    wget -q --https-only --secure-protocol=TLSv1_2 --tries=3 --timeout=20 -O "$output" "$url"
}
```

Reference: see `_ignore/openclaw/scripts/` — lines 43-67.

- [ ] **Step 3: Add TTY/non-interactive detection**

```bash
is_non_interactive_shell() {
    if [[ "${NO_PROMPT:-0}" == "1" ]]; then
        return 0
    fi
    if [[ ! -t 0 || ! -t 1 ]]; then
        return 0
    fi
    return 1
}
```

Reference: see `_ignore/openclaw/scripts/` — lines 83-91.

- [ ] **Step 4: Add OS/arch detection and SHA256 verification**

```bash
detect_os() {
    case "$(uname -s 2>/dev/null || true)" in
        Darwin) echo "Darwin" ;;
        Linux) echo "Linux" ;;
        *) echo "unsupported" ;;
    esac
}

detect_arch() {
    case "$(uname -m 2>/dev/null || true)" in
        x86_64|amd64) echo "x86_64" ;;
        arm64|aarch64) echo "arm64" ;;
        i386|i686) echo "i386" ;;
        armv7l|armv7) echo "armv7" ;;
        armv6l|armv6) echo "armv6" ;;
        *) echo "unknown" ;;
    esac
}

verify_sha256sum_file() {
    local checksums="$1"
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum --ignore-missing -c "$checksums" >/dev/null 2>&1
        return $?
    fi
    if command -v shasum >/dev/null 2>&1; then
        shasum -a 256 --ignore-missing -c "$checksums" >/dev/null 2>&1
        return $?
    fi
    return 1
}
```

Reference: see `_ignore/openclaw/scripts/` — lines 109-139.

- [ ] **Step 5: Verify file runs without errors**

Run: `bash -n scripts/install.sh`
Expected: No syntax errors (exit 0)

- [ ] **Step 6: Commit**

```bash
git add scripts/install.sh
git commit -m "feat(install): add install.sh skeleton with utilities"
```

---

## Task 2: install.sh — Gum Bootstrap (~Lines 141-234)

**Files:**
- Modify: `scripts/install.sh`

- [ ] **Step 1: Add gum bootstrap function**

Download charmbracelet/gum binary to temp dir, verify SHA256, extract, validate. Set `GUM` variable on success, fallback on failure. Follow reference implementation lines 141-234 exactly — same GUM_VERSION, same download pattern, same checksum verification, same fallback logic.

```bash
GUM_VERSION="${VIBEN_GUM_VERSION:-0.17.0}"
GUM=""
GUM_STATUS="skipped"
GUM_REASON=""

gum_is_tty() {
    if [[ -n "${NO_COLOR:-}" ]]; then return 1; fi
    if [[ "${TERM:-dumb}" == "dumb" ]]; then return 1; fi
    if [[ -t 2 || -t 1 ]]; then return 0; fi
    if [[ -r /dev/tty && -w /dev/tty ]]; then return 0; fi
    return 1
}

bootstrap_gum_temp() {
    GUM=""
    GUM_STATUS="skipped"
    GUM_REASON=""

    if is_non_interactive_shell; then
        GUM_REASON="non-interactive shell"
        return 1
    fi
    if ! gum_is_tty; then
        GUM_REASON="terminal does not support gum UI"
        return 1
    fi
    if command -v gum >/dev/null 2>&1; then
        GUM="gum"
        GUM_STATUS="found"
        GUM_REASON="already installed"
        return 0
    fi
    if ! command -v tar >/dev/null 2>&1; then
        GUM_REASON="tar not found"
        return 1
    fi

    local os arch asset base gum_tmpdir
    os="$(detect_os)"
    arch="$(detect_arch)"
    if [[ "$os" == "unsupported" || "$arch" == "unknown" ]]; then
        GUM_REASON="unsupported os/arch ($os/$arch)"
        return 1
    fi

    asset="gum_${GUM_VERSION}_${os}_${arch}.tar.gz"
    base="https://github.com/charmbracelet/gum/releases/download/v${GUM_VERSION}"

    gum_tmpdir="$(mktempdir)"

    if ! download_file "${base}/${asset}" "$gum_tmpdir/$asset"; then
        GUM_REASON="download failed"
        return 1
    fi
    if ! download_file "${base}/checksums.txt" "$gum_tmpdir/checksums.txt"; then
        GUM_REASON="checksum unavailable"
        return 1
    fi
    if ! (cd "$gum_tmpdir" && verify_sha256sum_file "checksums.txt"); then
        GUM_REASON="checksum verification failed"
        return 1
    fi
    if ! tar -xzf "$gum_tmpdir/$asset" -C "$gum_tmpdir" >/dev/null 2>&1; then
        GUM_REASON="extract failed"
        return 1
    fi

    local gum_path
    gum_path="$(find "$gum_tmpdir" -name gum -type f -perm +111 2>/dev/null | head -1)"
    if [[ -z "$gum_path" ]]; then
        gum_path="$gum_tmpdir/gum"
    fi
    if [[ ! -x "$gum_path" ]]; then
        GUM_REASON="binary not found after extract"
        return 1
    fi

    GUM="$gum_path"
    GUM_STATUS="installed"
    GUM_REASON="downloaded v${GUM_VERSION}"
    return 0
}

print_gum_status() {
    if [[ "$GUM_STATUS" == "found" ]]; then
        ui_info "gum: ${GUM_REASON}"
    elif [[ "$GUM_STATUS" == "installed" ]]; then
        ui_info "gum: ${GUM_REASON}"
    else
        ui_info "gum: skipped (${GUM_REASON}) — using plain text"
    fi
}
```

Reference: see `_ignore/openclaw/scripts/` — lines 141-234. Adapt exactly but use `detect_os`/`detect_arch` (our function names from Task 1).

- [ ] **Step 2: Verify syntax**

Run: `bash -n scripts/install.sh`
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add scripts/install.sh
git commit -m "feat(install): add gum bootstrap with SHA256 verification"
```

---

## Task 3: install.sh — UI Functions (~Lines 236-467)

**Files:**
- Modify: `scripts/install.sh`

- [ ] **Step 1: Add banner and OS detection**

```bash
TOTAL_STAGES=3
CURRENT_STAGE=0

print_installer_banner() {
    echo ""
    echo -e "${ACCENT}${BOLD}  ⚡ Viben Installer${NC}"
    echo -e "${MUTED}  ${DEFAULT_TAGLINE}${NC}"
    echo ""
}

detect_os_or_die() {
    local os
    os="$(detect_os)"
    case "$os" in
        Darwin)
            OS="macos"
            ;;
        Linux)
            OS="linux"
            if grep -qi microsoft /proc/version 2>/dev/null; then
                OS="wsl"
            fi
            ;;
        *)
            ui_error "Unsupported operating system: $(uname -s 2>/dev/null || echo unknown)"
            ui_error "Viben supports macOS and Linux."
            exit 1
            ;;
    esac
}
```

- [ ] **Step 2: Add ui_* output functions with gum fallback**

```bash
ui_info() {
    if [[ -n "$GUM" ]]; then
        "$GUM" log --level info "$@" 2>/dev/null || echo -e "${MUTED}· $*${NC}"
    else
        echo -e "${MUTED}· $*${NC}"
    fi
}

ui_warn() {
    if [[ -n "$GUM" ]]; then
        "$GUM" log --level warn "$@" 2>/dev/null || echo -e "${WARN}! $*${NC}"
    else
        echo -e "${WARN}! $*${NC}"
    fi
}

ui_success() {
    if [[ -n "$GUM" ]]; then
        "$GUM" style --foreground="#22c55e" "✓ $*" 2>/dev/null || echo -e "${SUCCESS}✓ $*${NC}"
    else
        echo -e "${SUCCESS}✓ $*${NC}"
    fi
}

ui_error() {
    if [[ -n "$GUM" ]]; then
        "$GUM" log --level error "$@" 2>/dev/null || echo -e "${ERROR}✗ $*${NC}" >&2
    else
        echo -e "${ERROR}✗ $*${NC}" >&2
    fi
}

ui_section() {
    echo ""
    echo -e "${ACCENT}${BOLD}$*${NC}"
}

ui_stage() {
    CURRENT_STAGE=$((CURRENT_STAGE + 1))
    ui_section "[$CURRENT_STAGE/$TOTAL_STAGES] $*"
}

ui_kv() {
    local key="$1" val="$2"
    if [[ -n "$GUM" ]]; then
        "$GUM" join --horizontal \
            "$("$GUM" style --foreground="#6366f1" --bold "$key ")" \
            "$("$GUM" style --foreground="#8892b0" "$val")" 2>/dev/null || echo -e "  ${ACCENT}${BOLD}$key${NC} ${INFO}$val${NC}"
    else
        echo -e "  ${ACCENT}${BOLD}$key${NC} ${INFO}$val${NC}"
    fi
}
```

Reference: see `_ignore/openclaw/scripts/` — lines 272-395 for the full pattern.

- [ ] **Step 3: Add spinner and quiet execution wrappers**

```bash
is_gum_raw_mode_failure() {
    local log="$1"
    [[ -f "$log" ]] && grep -q "setrawmode" "$log" 2>/dev/null
}

run_with_spinner() {
    local title="$1"
    shift
    if [[ -n "$GUM" ]]; then
        local errlog
        errlog="$(mktempfile)"
        "$GUM" spin --spinner dot --title "$title" -- "$@" 2>"$errlog" && return 0
        if is_gum_raw_mode_failure "$errlog"; then
            "$@"
            return $?
        fi
        return 1
    fi
    echo -e "${MUTED}$title${NC}"
    "$@"
}

run_quiet_step() {
    local title="$1"
    shift
    local log
    log="$(mktempfile)"
    if [[ -n "$GUM" ]]; then
        if "$GUM" spin --spinner dot --title "$title" -- bash -c '"$@" > "$0" 2>&1' "$log" "$@" 2>/dev/null; then
            return 0
        fi
    else
        echo -e "${MUTED}$title${NC}"
        if "$@" > "$log" 2>&1; then
            return 0
        fi
    fi
    ui_error "$title — failed"
    tail -5 "$log" 2>/dev/null | while IFS= read -r line; do
        echo -e "  ${MUTED}$line${NC}"
    done
    return 1
}

show_install_plan() {
    ui_kv "OS:" "$OS"
    ui_kv "Method:" "$INSTALL_METHOD"
    ui_kv "Version:" "$INSTALL_TAG"
    if [[ "$INSTALL_METHOD" == "git" ]]; then
        ui_kv "Git dir:" "$GIT_DIR"
    fi
    if [[ "$DRY_RUN" == "1" ]]; then
        ui_kv "Mode:" "dry-run (no changes)"
    fi
}

ui_celebrate() {
    echo ""
    echo -e "${SUCCESS}${BOLD}⚡ Viben installed successfully!${NC}"
}
```

Reference: see `_ignore/openclaw/scripts/` — lines 397-467 for spinner patterns.

- [ ] **Step 4: Verify syntax**

Run: `bash -n scripts/install.sh`
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add scripts/install.sh
git commit -m "feat(install): add UI functions with gum spinner support"
```

---

## Task 4: install.sh — Argument Parsing & Interactive Prompts (~Lines 468-600)

**Files:**
- Modify: `scripts/install.sh`

- [ ] **Step 1: Add help text and argument parsing**

```bash
INSTALL_METHOD="npm"
INSTALL_TAG="latest"
GIT_DIR="${VIBEN_GIT_DIR:-$HOME/viben}"
NO_ONBOARD=0
DRY_RUN=0
VERBOSE=0
NO_GIT_UPDATE=0
DO_VERIFY=0

print_usage() {
    cat <<'USAGE'
Viben Installer

Usage:
  curl -fsSL https://raw.githubusercontent.com/Viben/Viben/main/scripts/install.sh | bash
  curl -fsSL ... | bash -s -- [options]

Options:
  --install-method <npm|git>        Installation method (default: npm)
  --version <version|tag|spec>      npm install target (default: latest; use "main" for GitHub main)
  --git-dir <path>                  Directory for git install (default: ~/viben)
  --no-onboard                      Skip running viben after install
  --no-git-update                   Skip git pull on existing repo
  --dry-run                         Print actions without executing
  --verify                          Verify installation after completion
  --verbose                         Enable verbose output
  --help                            Show this help

Examples:
  curl -fsSL https://raw.githubusercontent.com/Viben/Viben/main/scripts/install.sh | bash
  curl -fsSL ... | bash -s -- --version 2026.328.2
  curl -fsSL ... | bash -s -- --install-method git --no-onboard
USAGE
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --help|-h)
                print_usage
                exit 0
                ;;
            --install-method)
                INSTALL_METHOD="$2"
                shift 2
                ;;
            --version)
                INSTALL_TAG="$2"
                shift 2
                ;;
            --git-dir)
                GIT_DIR="$2"
                shift 2
                ;;
            --no-onboard)
                NO_ONBOARD=1
                shift
                ;;
            --no-git-update)
                NO_GIT_UPDATE=1
                shift
                ;;
            --dry-run)
                DRY_RUN=1
                shift
                ;;
            --verify)
                DO_VERIFY=1
                shift
                ;;
            --verbose)
                VERBOSE=1
                shift
                ;;
            *)
                ui_error "Unknown option: $1"
                print_usage
                exit 1
                ;;
        esac
    done
}

configure_verbose() {
    if [[ "$VERBOSE" == "1" ]]; then
        set -x
    fi
}
```

Reference: see `_ignore/openclaw/scripts/` — lines 981-1101.

- [ ] **Step 2: Add interactive prompts**

```bash
is_promptable() {
    if [[ "${NO_PROMPT:-0}" == "1" ]]; then return 1; fi
    if [[ ! -t 0 || ! -t 1 ]]; then return 1; fi
    return 0
}

prompt_choice() {
    local prompt="$1"
    shift
    if [[ -n "$GUM" ]]; then
        "$GUM" choose --header "$prompt" "$@" 2>/dev/null && return 0
    fi
    echo "$prompt" >&2
    local i=1
    for opt in "$@"; do
        echo "  $i) $opt" >&2
        i=$((i + 1))
    done
    local choice
    read -rp "Choice [1]: " choice
    choice="${choice:-1}"
    local idx=1
    for opt in "$@"; do
        if [[ "$idx" == "$choice" ]]; then
            echo "$opt"
            return 0
        fi
        idx=$((idx + 1))
    done
    echo "$1"
}

choose_install_method_interactive() {
    if ! is_promptable; then return; fi
    if [[ "$INSTALL_METHOD" != "npm" ]]; then return; fi

    local choice
    choice="$(prompt_choice "How would you like to install Viben?" \
        "npm — recommended, simple global install" \
        "git — clone and build from source")"

    case "$choice" in
        *npm*) INSTALL_METHOD="npm" ;;
        *git*) INSTALL_METHOD="git" ;;
    esac
}
```

Reference: see `_ignore/openclaw/scripts/` — lines 1103-1177.

- [ ] **Step 3: Verify syntax**

Run: `bash -n scripts/install.sh`
Expected: exit 0

- [ ] **Step 4: Commit**

```bash
git add scripts/install.sh
git commit -m "feat(install): add argument parsing and interactive prompts"
```

---

## Task 5: install.sh — Node.js Detection & Installation (~Lines 601-850)

**Files:**
- Modify: `scripts/install.sh`

- [ ] **Step 1: Add Node.js version detection**

```bash
node_major_version() {
    local version
    version="$(node --version 2>/dev/null || true)"
    if [[ -z "$version" ]]; then
        return 1
    fi
    echo "$version" | sed 's/^v//' | cut -d. -f1
}

node_is_at_least_required() {
    local version
    version="$(node --version 2>/dev/null || true)"
    if [[ -z "$version" ]]; then return 1; fi
    local major minor
    major="$(echo "$version" | sed 's/^v//' | cut -d. -f1)"
    minor="$(echo "$version" | sed 's/^v//' | cut -d. -f2)"
    if [[ "$major" -gt "$NODE_MIN_MAJOR" ]]; then return 0; fi
    if [[ "$major" -eq "$NODE_MIN_MAJOR" && "$minor" -ge "$NODE_MIN_MINOR" ]]; then return 0; fi
    return 1
}

check_node() {
    if ! command -v node >/dev/null 2>&1; then
        return 1
    fi
    if node_is_at_least_required; then
        ui_success "Node.js $(node --version 2>/dev/null) found"
        return 0
    fi
    local major
    major="$(node_major_version || echo "?")"
    ui_warn "Node.js v${major} found, but need v${NODE_MIN_MAJOR}+"
    return 1
}
```

Reference: see `_ignore/openclaw/scripts/` — lines 1241-1397.

- [ ] **Step 2: Add nvm/nodenv/fnm awareness**

```bash
ensure_default_node_active_shell() {
    # Source nvm if detected
    if [[ -n "${NVM_DIR:-}" ]] && [[ -s "$NVM_DIR/nvm.sh" ]]; then
        # shellcheck disable=SC1091
        source "$NVM_DIR/nvm.sh" 2>/dev/null || true
        return 0
    fi
    if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
        export NVM_DIR="$HOME/.nvm"
        # shellcheck disable=SC1091
        source "$NVM_DIR/nvm.sh" 2>/dev/null || true
        return 0
    fi
    # Source fnm if detected
    if command -v fnm >/dev/null 2>&1; then
        eval "$(fnm env 2>/dev/null)" || true
        return 0
    fi
    # nodenv
    if command -v nodenv >/dev/null 2>&1; then
        eval "$(nodenv init - 2>/dev/null)" || true
        return 0
    fi
    return 0
}

print_nvm_upgrade_hint() {
    local nvm_detected=0
    if [[ -n "${NVM_DIR:-}" || "${PATH:-}" == *"/.nvm/"* ]]; then
        nvm_detected=1
    fi
    if command -v nvm >/dev/null 2>&1; then
        nvm_detected=1
    fi
    if [[ "$nvm_detected" -eq 1 ]]; then
        echo ""
        ui_info "nvm appears to be managing Node for this shell."
        ui_info "Try:"
        ui_info "  nvm install ${NODE_DEFAULT_MAJOR}"
        ui_info "  nvm use ${NODE_DEFAULT_MAJOR}"
        ui_info "  nvm alias default ${NODE_DEFAULT_MAJOR}"
        return 0
    fi
    return 1
}
```

Reference: see `_ignore/openclaw/scripts/` — lines 1341-1397.

- [ ] **Step 3: Add Node.js installation**

```bash
install_node() {
    ui_info "Node.js not found or too old — installing..."

    # Try nvm first (works on both macOS and Linux)
    if command -v nvm >/dev/null 2>&1 || [[ -s "$HOME/.nvm/nvm.sh" ]]; then
        ensure_default_node_active_shell
        if command -v nvm >/dev/null 2>&1; then
            ui_info "Installing Node.js ${NODE_DEFAULT_MAJOR} via nvm..."
            nvm install "$NODE_DEFAULT_MAJOR" || {
                ui_error "nvm install failed"
                return 1
            }
            nvm use "$NODE_DEFAULT_MAJOR"
            nvm alias default "$NODE_DEFAULT_MAJOR"
            ui_success "Node.js $(node --version) installed via nvm"
            return 0
        fi
    fi

    # Install nvm if not present, then install Node
    ui_info "Installing nvm..."
    local nvm_install_url="https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh"
    local nvm_script
    nvm_script="$(mktempfile)"
    if ! download_file "$nvm_install_url" "$nvm_script"; then
        ui_error "Failed to download nvm installer"
        return 1
    fi
    bash "$nvm_script" 2>/dev/null || {
        ui_error "nvm installation failed"
        return 1
    }

    export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
    # shellcheck disable=SC1091
    source "$NVM_DIR/nvm.sh" 2>/dev/null || {
        ui_error "Failed to load nvm after install"
        return 1
    }

    ui_info "Installing Node.js ${NODE_DEFAULT_MAJOR} via nvm..."
    nvm install "$NODE_DEFAULT_MAJOR" || {
        ui_error "nvm install Node.js failed"
        return 1
    }
    nvm use "$NODE_DEFAULT_MAJOR"
    nvm alias default "$NODE_DEFAULT_MAJOR"

    ui_success "Node.js $(node --version) installed via nvm"
    return 0
}
```

Reference: see `_ignore/openclaw/scripts/` — lines 1398-1476. reference implementation uses nvm install on macOS/Linux as the primary method.

- [ ] **Step 4: Verify syntax**

Run: `bash -n scripts/install.sh`
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add scripts/install.sh
git commit -m "feat(install): add Node.js detection and installation via nvm"
```

---

## Task 6: install.sh — Git, npm Permissions & Package Install (~Lines 851-1100)

**Files:**
- Modify: `scripts/install.sh`

- [ ] **Step 1: Add git detection, sudo helpers, and git installation**

```bash
check_git() {
    if command -v git >/dev/null 2>&1; then
        ui_success "$(git --version) found"
        return 0
    fi
    return 1
}

is_root() {
    [[ "$(id -u)" -eq 0 ]]
}

maybe_sudo() {
    if is_root; then
        echo ""
        return
    fi
    if command -v sudo >/dev/null 2>&1; then
        echo "sudo"
        return
    fi
    echo ""
}

install_git() {
    local sudo_cmd
    sudo_cmd="$(maybe_sudo)"

    if [[ "$OS" == "macos" ]]; then
        # macOS: xcode-select installs git
        ui_info "Installing git via Xcode Command Line Tools..."
        xcode-select --install 2>/dev/null || true
        if command -v git >/dev/null 2>&1; then
            ui_success "git installed"
            return 0
        fi
        ui_error "Please install Xcode Command Line Tools and retry"
        return 1
    fi

    # Linux
    if command -v apt-get >/dev/null 2>&1; then
        run_quiet_step "Installing git" $sudo_cmd apt-get install -y git
    elif command -v yum >/dev/null 2>&1; then
        run_quiet_step "Installing git" $sudo_cmd yum install -y git
    elif command -v pacman >/dev/null 2>&1; then
        run_quiet_step "Installing git" $sudo_cmd pacman -S --noconfirm git
    else
        ui_error "Could not install git automatically"
        ui_info "Please install git and retry"
        return 1
    fi
    ui_success "git installed"
}
```

Reference: see `_ignore/openclaw/scripts/` — lines 1477-1561.

- [ ] **Step 2: Add npm permission fix**

```bash
fix_npm_permissions() {
    if is_root; then return 0; fi
    if [[ "$OS" == "macos" ]]; then return 0; fi

    local npm_root
    npm_root="$(npm root -g 2>/dev/null || true)"
    if [[ -n "$npm_root" ]] && [[ -w "$npm_root" ]]; then
        return 0
    fi

    ui_info "Fixing npm permissions..."
    mkdir -p "$HOME/.npm-global"
    npm config set prefix "$HOME/.npm-global"

    local path_line='export PATH="$HOME/.npm-global/bin:$PATH"'
    for rc in "$HOME/.bashrc" "$HOME/.zshrc" "$HOME/.profile"; do
        if [[ -f "$rc" ]] && ! grep -q ".npm-global" "$rc"; then
            echo "$path_line" >> "$rc"
        fi
    done
    export PATH="$HOME/.npm-global/bin:$PATH"
    ui_success "npm global prefix set to ~/.npm-global"
}
```

Reference: see `_ignore/openclaw/scripts/` — lines 1562-1592.

- [ ] **Step 3: Add npm install with retry and error diagnostics**

```bash
LAST_NPM_INSTALL_CMD=""

run_npm_global_install() {
    local spec="$1"
    local log
    log="$(mktempfile)"
    LAST_NPM_INSTALL_CMD="npm install -g ${spec}"

    npm install -g --no-fund --no-audit "$spec" > "$log" 2>&1
}

resolve_package_install_spec() {
    local target="${INSTALL_TAG:-latest}"
    if [[ -z "$target" || "$target" == "latest" ]]; then
        echo "@viben/kernel@latest"
        return
    fi
    if [[ "$target" == "main" ]]; then
        echo "github:Viben/Viben#main"
        return
    fi
    echo "@viben/kernel@${target}"
}

install_viben_npm() {
    local spec
    spec="$(resolve_package_install_spec)"

    ui_info "Installing Viben (${spec})..."
    local log
    log="$(mktempfile)"

    local attempt
    for attempt in 1 2 3; do
        if npm install -g --no-fund --no-audit "$spec" > "$log" 2>&1; then
            ui_success "Viben installed via npm"
            return 0
        fi
        if [[ "$attempt" -lt 3 ]]; then
            ui_warn "npm install failed (attempt $attempt/3), retrying..."
            sleep 2
        fi
    done

    ui_error "npm install failed after 3 attempts"
    ui_info "Last log:"
    tail -10 "$log" 2>/dev/null | while IFS= read -r line; do
        echo -e "  ${MUTED}$line${NC}"
    done
    ui_info ""
    ui_info "Try manually: npm install -g ${spec}"
    return 1
}
```

Reference: see `_ignore/openclaw/scripts/` — lines 675-839 for the full npm install + retry + diagnostics pattern.

- [ ] **Step 4: Add git-based installation**

```bash
install_viben_from_git() {
    local repo_dir="$GIT_DIR"

    if [[ ! -d "$repo_dir" ]]; then
        ui_info "Cloning Viben repository..."
        run_quiet_step "Cloning repository" git clone https://github.com/LinXueyuanStdio/viben.git "$repo_dir"
    elif [[ "$NO_GIT_UPDATE" != "1" ]]; then
        ui_info "Updating Viben repository..."
        run_quiet_step "Updating repository" git -C "$repo_dir" pull --rebase
    fi

    # Install pnpm if not present
    if ! command -v pnpm >/dev/null 2>&1; then
        ui_info "Installing pnpm..."
        run_quiet_step "Installing pnpm" npm install -g pnpm@10
    fi

    # Install dependencies and build
    run_quiet_step "Installing dependencies" pnpm install --dir "$repo_dir"
    run_quiet_step "Building" pnpm --dir "$repo_dir" build

    # Create wrapper in ~/.local/bin
    local bin_dir="$HOME/.local/bin"
    mkdir -p "$bin_dir"
    cat > "$bin_dir/viben" <<WRAPPER
#!/bin/bash
exec node "${repo_dir}/dist/cli.js" "\$@"
WRAPPER
    chmod +x "$bin_dir/viben"

    ui_success "Viben installed from git to $repo_dir"
}
```

Reference: see `_ignore/openclaw/scripts/` — lines 1885-1926.

- [ ] **Step 5: Verify syntax**

Run: `bash -n scripts/install.sh`
Expected: exit 0

- [ ] **Step 6: Commit**

```bash
git add scripts/install.sh
git commit -m "feat(install): add npm/git installation with retry logic"
```

---

## Task 7: install.sh — PATH Management & Verification (~Lines 1101-1200)

**Files:**
- Modify: `scripts/install.sh`

- [ ] **Step 1: Add PATH management functions**

```bash
ensure_user_local_bin_on_path() {
    local bin_dir="$HOME/.local/bin"
    if [[ ":$PATH:" == *":$bin_dir:"* ]]; then return 0; fi

    export PATH="$bin_dir:$PATH"
    local path_line='export PATH="$HOME/.local/bin:$PATH"'
    for rc in "$HOME/.bashrc" "$HOME/.zshrc" "$HOME/.profile"; do
        if [[ -f "$rc" ]] && ! grep -q '.local/bin' "$rc"; then
            echo "$path_line" >> "$rc"
        fi
    done
    ui_info "Added ~/.local/bin to PATH"
}

npm_global_bin_dir() {
    local prefix
    prefix="$(npm config get prefix 2>/dev/null || true)"
    if [[ -n "$prefix" ]]; then
        echo "${prefix}/bin"
        return
    fi
    echo ""
}

ensure_npm_global_bin_on_path() {
    local bin_dir
    bin_dir="$(npm_global_bin_dir)"
    if [[ -z "$bin_dir" ]]; then return; fi
    if [[ ":$PATH:" == *":$bin_dir:"* ]]; then return; fi

    ui_warn "npm global bin directory ($bin_dir) is not on your PATH"
    ui_info "Add to your shell profile:"
    ui_info "  export PATH=\"$bin_dir:\$PATH\""
}

refresh_shell_command_cache() {
    hash -r 2>/dev/null || true
}

resolve_viben_bin() {
    # Check ~/.local/bin first (git installs)
    if [[ -x "$HOME/.local/bin/viben" ]]; then
        echo "$HOME/.local/bin/viben"
        return 0
    fi
    # Check npm global
    local npm_bin
    npm_bin="$(npm_global_bin_dir)"
    if [[ -n "$npm_bin" && -x "$npm_bin/viben" ]]; then
        echo "$npm_bin/viben"
        return 0
    fi
    # Check PATH
    if command -v viben >/dev/null 2>&1; then
        command -v viben
        return 0
    fi
    return 1
}

verify_installation() {
    local bin
    if ! bin="$(resolve_viben_bin)"; then
        ui_error "viben not found on PATH after installation"
        ui_info "Try opening a new terminal, or run:"
        ui_info "  source ~/.bashrc  # or ~/.zshrc"
        return 1
    fi

    local version
    version="$("$bin" --version 2>/dev/null || echo "unknown")"
    ui_success "viben $version installed at $bin"
    return 0
}
```

Reference: see `_ignore/openclaw/scripts/` — lines 1735-1869 for PATH management, lines 2224-2255 for verification.

- [ ] **Step 2: Verify syntax**

Run: `bash -n scripts/install.sh`
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add scripts/install.sh
git commit -m "feat(install): add PATH management and installation verification"
```

---

## Task 8: install.sh — Taglines & Main Function (~Lines 1201-end)

**Files:**
- Modify: `scripts/install.sh`

- [ ] **Step 1: Add taglines**

```bash
TAGLINES=()
TAGLINES+=("Your terminal just got smarter.")
TAGLINES+=("AI agents, one chat away.")
TAGLINES+=("Bridge built. Agents ready.")
TAGLINES+=("From chat to code in seconds.")
TAGLINES+=("Your AI coding crew is online.")
TAGLINES+=("All platforms. One command center.")
TAGLINES+=("Talk to your codebase. Literally.")
TAGLINES+=("The bridge is up. Cross it.")
TAGLINES+=("Agents assembled. Ready to code.")
TAGLINES+=("Your terminal. Your agents. Your rules.")

pick_tagline() {
    local count=${#TAGLINES[@]}
    if [[ "$count" -eq 0 ]]; then
        echo "$DEFAULT_TAGLINE"
        return
    fi
    local idx=$((RANDOM % count))
    echo "${TAGLINES[$idx]}"
}
```

Reference: see `_ignore/openclaw/scripts/` — lines 842-980 for tagline pattern.

- [ ] **Step 2: Add main function**

```bash
main() {
    # Bootstrap gum for fancy UI
    bootstrap_gum_temp || true
    print_installer_banner
    print_gum_status
    detect_os_or_die

    # Interactive install method choice
    choose_install_method_interactive

    # Show plan
    show_install_plan
    echo ""

    # Dry run check
    if [[ "$DRY_RUN" == "1" ]]; then
        ui_info "[DRY RUN] Would install Viben via $INSTALL_METHOD"
        exit 0
    fi

    # Stage 1: Prepare environment
    ui_stage "Preparing environment"

    ensure_default_node_active_shell

    if ! check_node; then
        install_node || {
            ui_error "Failed to install Node.js"
            print_nvm_upgrade_hint || true
            exit 1
        }
    fi

    # Stage 2: Install Viben
    ui_stage "Installing Viben"

    if [[ "$INSTALL_METHOD" == "git" ]]; then
        if ! check_git; then
            install_git || exit 1
        fi
        install_viben_from_git || exit 1
        ensure_user_local_bin_on_path
    else
        if ! check_git; then
            install_git || ui_warn "Git not available (optional for npm installs)"
        fi
        fix_npm_permissions
        install_viben_npm || exit 1
        ensure_npm_global_bin_on_path
    fi

    # Stage 3: Finalize
    ui_stage "Finalizing"

    refresh_shell_command_cache

    if [[ "$DO_VERIFY" == "1" ]]; then
        verify_installation || exit 1
    fi

    # Celebrate
    local tagline
    tagline="$(pick_tagline)"
    ui_celebrate
    echo -e "  ${MUTED}${tagline}${NC}"
    echo ""

    # Launch viben or print instructions
    if [[ "$NO_ONBOARD" == "1" ]]; then
        ui_info "Skipping onboard (requested). Run 'viben' to get started."
        exit 0
    fi

    local claw
    if claw="$(resolve_viben_bin)"; then
        if [[ -t 0 && -t 1 ]]; then
            exec "$claw"
        else
            ui_info "No TTY; run 'viben' to complete setup"
        fi
    else
        ui_info "Run 'viben' to complete setup"
        ui_info "If command not found, open a new terminal first"
    fi
}
```

Reference: see `_ignore/openclaw/scripts/` — lines 2256-2550 for the full main() flow.

- [ ] **Step 3: Add entry point**

```bash
if [[ "${VIBEN_INSTALL_SH_NO_RUN:-0}" != "1" ]]; then
    parse_args "$@"
    configure_verbose
    main
fi
```

Reference: see `_ignore/openclaw/scripts/` — lines 2552-2555.

- [ ] **Step 4: Make executable and verify**

Run: `chmod +x scripts/install.sh && bash -n scripts/install.sh`
Expected: exit 0

- [ ] **Step 5: Test dry run locally**

Run: `bash scripts/install.sh --dry-run`
Expected: Banner prints, install plan shows, "[DRY RUN]" message, exits cleanly.

- [ ] **Step 6: Commit**

```bash
git add scripts/install.sh
git commit -m "feat(install): add main orchestration and entry point"
```

---

## Task 9: install.ps1 — Windows Installer

**Files:**
- Create: `scripts/install.ps1`

- [ ] **Step 1: Create install.ps1 with full Windows installer**

Write the complete `scripts/install.ps1` following reference implementation's `_ignore/openclaw/scripts/install.ps1` as reference (~300 lines). Adapt all reference implementation-specific names to Viben:

```powershell
# Viben Installer for Windows (PowerShell)
# Usage: powershell -c "irm https://raw.githubusercontent.com/Viben/Viben/main/scripts/install.ps1 | iex"

param(
    [string]$InstallMethod = "npm",
    [string]$Tag = "latest",
    [string]$GitDir = "$env:USERPROFILE\viben",
    [switch]$NoOnboard,
    [switch]$NoGitUpdate,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

# Colors
$ACCENT = "`e[38;2;99;102;241m"     # indigo
$SUCCESS = "`e[38;2;34;197;94m"      # green
$WARN = "`e[38;2;250;204;21m"        # yellow
$ERROR = "`e[38;2;239;68;68m"        # red
$MUTED = "`e[38;2;90;100;128m"       # text-muted
$NC = "`e[0m"

function Write-Msg {
    param([string]$Message, [string]$Level = "info")
    $msg = switch ($Level) {
        "success" { "$SUCCESS`u{2713}$NC $Message" }
        "warn" { "$WARN!$NC $Message" }
        "error" { "$ERROR`u{2717}$NC $Message" }
        default { "$MUTED`u{00B7}$NC $Message" }
    }
    Microsoft.PowerShell.Host\Write-Host $msg
}

function Write-Banner {
    Write-Host ""
    Write-Host "${ACCENT}  `u{26A1} Viben Installer$NC"
    Write-Host "${MUTED}  Bridge AI agents to your chat.$NC"
    Write-Host ""
}

function Get-ExecutionPolicyStatus {
    $policy = Get-ExecutionPolicy
    if ($policy -eq "Restricted" -or $policy -eq "AllSigned") {
        return @{ Blocked = $true; Policy = $policy }
    }
    return @{ Blocked = $false; Policy = $policy }
}

function Ensure-ExecutionPolicy {
    $status = Get-ExecutionPolicyStatus
    if ($status.Blocked) {
        Write-Msg "PowerShell execution policy is: $($status.Policy)" -Level warn
        try {
            Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process -ErrorAction Stop
            Write-Msg "Set execution policy to RemoteSigned for current process" -Level success
            return $true
        } catch {
            Write-Msg "Could not set execution policy automatically" -Level error
            Write-Msg "Run: Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process" -Level info
            return $false
        }
    }
    return $true
}

function Get-NodeVersion {
    try {
        $version = node --version 2>$null
        if ($version) { return $version -replace '^v', '' }
    } catch { }
    return $null
}

function Install-Node {
    Write-Msg "Node.js not found" -Level info
    Write-Msg "Installing Node.js..." -Level info

    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Write-Msg "  Using winget..." -Level info
        try {
            winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements 2>&1 | Out-Null
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
            Write-Msg "  Node.js installed via winget" -Level success
            return $true
        } catch {
            Write-Msg "  Winget install failed: $_" -Level warn
        }
    }

    if (Get-Command choco -ErrorAction SilentlyContinue) {
        Write-Msg "  Using chocolatey..." -Level info
        try {
            choco install nodejs-lts -y 2>&1 | Out-Null
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
            Write-Msg "  Node.js installed via chocolatey" -Level success
            return $true
        } catch {
            Write-Msg "  Chocolatey install failed: $_" -Level warn
        }
    }

    if (Get-Command scoop -ErrorAction SilentlyContinue) {
        Write-Msg "  Using scoop..." -Level info
        try {
            scoop install nodejs-lts 2>&1 | Out-Null
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
            Write-Msg "  Node.js installed via scoop" -Level success
            return $true
        } catch {
            Write-Msg "  Scoop install failed: $_" -Level warn
        }
    }

    Write-Msg "Could not install Node.js automatically" -Level error
    Write-Msg "Please install Node.js 22+ from: https://nodejs.org" -Level info
    return $false
}

function Ensure-Node {
    $nodeVersion = Get-NodeVersion
    if ($nodeVersion) {
        $major = [int]($nodeVersion -split '\.')[0]
        if ($major -ge 22) {
            Write-Msg "Node.js v$nodeVersion found" -Level success
            return $true
        }
        Write-Msg "Node.js v$nodeVersion found, but need v22+" -Level warn
    }
    return Install-Node
}

function Ensure-Git {
    try {
        $gitVersion = git --version 2>$null
        if ($gitVersion) {
            Write-Msg "$gitVersion found" -Level success
            return $true
        }
    } catch { }

    Write-Msg "Git not found" -Level info
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Write-Msg "  Installing Git via winget..." -Level info
        try {
            winget install Git.Git --accept-package-agreements --accept-source-agreements 2>&1 | Out-Null
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
            Write-Msg "  Git installed" -Level success
            return $true
        } catch {
            Write-Msg "  Winget install failed" -Level warn
        }
    }

    Write-Msg "Please install Git from: https://git-scm.com" -Level error
    return $false
}

function Resolve-PackageInstallSpec {
    param([string]$Target = "latest")
    $trimmed = $Target.Trim()
    if ([string]::IsNullOrWhiteSpace($trimmed) -or $trimmed -eq "latest") {
        return "@viben/kernel@latest"
    }
    if ($trimmed.ToLowerInvariant() -eq "main") {
        return "github:Viben/Viben#main"
    }
    return "@viben/kernel@$trimmed"
}

function Install-VibenNpm {
    param([string]$Target = "latest")
    $installSpec = Resolve-PackageInstallSpec -Target $Target

    Write-Msg "Installing Viben ($installSpec)..." -Level info
    try {
        npm install -g $installSpec --no-fund --no-audit 2>&1
        Write-Msg "Viben installed" -Level success
        return $true
    } catch {
        Write-Msg "npm install failed: $_" -Level error
        return $false
    }
}

function Install-VibenGit {
    param([string]$RepoDir, [switch]$Update)

    Write-Msg "Installing Viben from git..." -Level info

    if (!(Test-Path $RepoDir)) {
        Write-Msg "  Cloning repository..." -Level info
        git clone https://github.com/LinXueyuanStdio/viben.git $RepoDir 2>&1
    } elseif ($Update) {
        Write-Msg "  Updating repository..." -Level info
        git -C $RepoDir pull --rebase 2>&1
    }

    if (!(Get-Command pnpm -ErrorAction SilentlyContinue)) {
        Write-Msg "  Installing pnpm..." -Level info
        npm install -g pnpm 2>&1
    }

    Write-Msg "  Installing dependencies..." -Level info
    pnpm install --dir $RepoDir 2>&1

    Write-Msg "  Building..." -Level info
    pnpm --dir $RepoDir build 2>&1

    $wrapperDir = "$env:USERPROFILE\.local\bin"
    if (!(Test-Path $wrapperDir)) {
        New-Item -ItemType Directory -Path $wrapperDir -Force | Out-Null
    }

    @"
@echo off
node "%~dp0..\..\viben\dist\cli.js" %*
"@ | Out-File -FilePath "$wrapperDir\viben.cmd" -Encoding ASCII -Force

    Write-Msg "Viben installed" -Level success
    return $true
}

function Add-ToPath {
    param([string]$Path)
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($currentPath -notlike "*$Path*") {
        [Environment]::SetEnvironmentVariable("Path", "$currentPath;$Path", "User")
        Write-Msg "Added $Path to user PATH" -Level info
    }
}

function Main {
    Write-Banner
    Write-Msg "Windows detected" -Level success

    if (!(Ensure-ExecutionPolicy)) {
        Write-Msg "Installation cannot continue due to execution policy restrictions" -Level error
        exit 1
    }

    if (!(Ensure-Node)) { exit 1 }

    if ($InstallMethod -eq "git") {
        if (!(Ensure-Git)) { exit 1 }
        if ($DryRun) {
            Write-Msg "[DRY RUN] Would install Viben from git to $GitDir" -Level info
        } else {
            Install-VibenGit -RepoDir $GitDir -Update:(-not $NoGitUpdate)
        }
    } else {
        if (!(Ensure-Git)) {
            Write-Msg "Git is recommended but not required for npm installs" -Level warn
        }
        if ($DryRun) {
            Write-Msg "[DRY RUN] Would install Viben via npm ($((Resolve-PackageInstallSpec -Target $Tag)))" -Level info
        } else {
            if (!(Install-VibenNpm -Target $Tag)) { exit 1 }
        }
    }

    # Add npm global bin to PATH
    try {
        $npmPrefix = npm config get prefix 2>$null
        if ($npmPrefix) { Add-ToPath -Path "$npmPrefix" }
    } catch { }

    if (!$NoOnboard -and !$DryRun) {
        Write-Host ""
        Write-Msg "`u{26A1} Viben installed successfully!" -Level success
        Write-Host ""
        try {
            $claw = Get-Command viben -ErrorAction Stop
            & $claw.Source
        } catch {
            Write-Msg "Run 'viben' to complete setup" -Level info
        }
    } else {
        Write-Host ""
        Write-Msg "`u{26A1} Viben installed successfully!" -Level success
        if (!$DryRun) {
            Write-Msg "Run 'viben' to get started" -Level info
        }
    }
}

Main
```

Reference: see `_ignore/openclaw/scripts/` — `_ignore/openclaw/scripts/install.ps1` — same structure, adapted for Viben branding and package name.

- [ ] **Step 2: Verify PowerShell syntax (if on Windows/pwsh)**

Run: `pwsh -NoProfile -Command "& { \$null = [System.Management.Automation.Language.Parser]::ParseFile('scripts/install.ps1', [ref]\$null, [ref]\$null) }"`
Expected: No parse errors. (Skip if pwsh not available — the PS1 follows proven reference implementation patterns.)

- [ ] **Step 3: Commit**

```bash
git add scripts/install.ps1
git commit -m "feat(install): add Windows PowerShell installer"
```

---

## Task 10: Update README.md

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add one-liner Quick Start section**

Replace the existing Quick Start section in `README.md` (lines 50-65) with:

```markdown
## Quick Start

```bash
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/Viben/Viben/main/scripts/install.sh | bash

# Windows
powershell -c "irm https://raw.githubusercontent.com/Viben/Viben/main/scripts/install.ps1 | iex"
```

Works on macOS, Linux & Windows. Installs Node.js (if needed) and everything else for you.

<details>
<summary>Or install via npm</summary>

```bash
npm install -g @viben/kernel
viben
```

</details>

The interactive setup wizard walks you through everything:

1. Choose your platform (Telegram, Discord, Slack, or multiple)
2. Connect your bot (token validation + auto-detection)
3. Pick a workspace directory
4. Select your default AI agent
5. Choose run mode (foreground or daemon)

That's it. Send a message to your bot and start coding.

> **Need detailed setup for a specific platform?** See the [Platform Setup guides](https://viben.gitbook.io/docs/platform-setup).
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add one-liner install commands to Quick Start"
```

---

## Task 11: End-to-End Testing

- [ ] **Step 1: Test install.sh --dry-run on local machine**

Run: `bash scripts/install.sh --dry-run`
Expected: Banner prints, gum bootstraps (or skips gracefully), plan shows, "[DRY RUN]" exits cleanly.

- [ ] **Step 2: Test install.sh --help**

Run: `bash scripts/install.sh --help`
Expected: Help text prints with all flags.

- [ ] **Step 3: Test install.sh --dry-run --install-method git**

Run: `bash scripts/install.sh --dry-run --install-method git`
Expected: Plan shows git method and git dir.

- [ ] **Step 4: Test syntax of both scripts**

Run: `bash -n scripts/install.sh && echo "install.sh OK"`
Expected: "install.sh OK"

- [ ] **Step 5: Fix any issues found during testing and commit**

```bash
git add scripts/install.sh scripts/install.ps1
git commit -m "fix(install): address issues found during testing"
```

(Only if needed — skip if no issues.)

---

Plan complete and saved to `docs/superpowers/plans/2026-03-29-one-liner-install-script.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?