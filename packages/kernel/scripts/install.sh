#!/bin/bash
set -euo pipefail

# Viben Installer for macOS and Linux
# Usage: curl -fsSL https://raw.githubusercontent.com/Viben/Viben/main/scripts/install.sh | bash

# ─── Section 1: Initialization & Utilities ────────────────────────────────────

BOLD='\033[1m'
ACCENT='\033[38;2;99;102;241m'         # indigo #6366f1
INFO='\033[38;2;136;146;176m'          # text-secondary #8892b0
SUCCESS='\033[38;2;34;197;94m'         # green #22c55e
WARN='\033[38;2;250;204;21m'           # yellow #facc15
ERROR='\033[38;2;239;68;68m'           # red #ef4444
MUTED='\033[38;2;90;100;128m'          # text-muted #5a6480
NC='\033[0m'

INSTALLER_VERSION="1.0.3"

DEFAULT_TAGLINE="AI coding agents, anywhere."
NODE_DEFAULT_MAJOR=20
NODE_MIN_MAJOR=20
NODE_MIN_MINOR=0
NODE_MIN_VERSION="${NODE_MIN_MAJOR}.${NODE_MIN_MINOR}"

# Initialize Homebrew PATH for non-login shells (macOS).
# ~/.zprofile is not sourced when running as 'bash install.sh' or 'curl | bash',
# so /opt/homebrew/bin (Apple Silicon) or /usr/local/bin (Intel) may be missing from PATH.
if [[ -x "/opt/homebrew/bin/brew" ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)" 2>/dev/null || true
elif [[ -x "/usr/local/bin/brew" ]]; then
    eval "$(/usr/local/bin/brew shellenv)" 2>/dev/null || true
fi

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

DOWNLOADER=""
detect_downloader() {
    if command -v curl &>/dev/null; then
        DOWNLOADER="curl"
        return 0
    fi
    if command -v wget &>/dev/null; then
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

is_non_interactive_shell() {
    if [[ "${NO_PROMPT:-0}" == "1" ]]; then
        return 0
    fi
    if [[ ! -t 0 || ! -t 1 ]]; then
        return 0
    fi
    return 1
}

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

# ─── Section 2: Gum Bootstrap ─────────────────────────────────────────────────

GUM_VERSION="${VIBEN_GUM_VERSION:-0.17.0}"
GUM=""
GUM_STATUS="skipped"
GUM_REASON=""

gum_is_tty() {
    if [[ -n "${NO_COLOR:-}" ]]; then
        return 1
    fi
    if [[ "${TERM:-dumb}" == "dumb" ]]; then
        return 1
    fi
    if [[ -t 2 || -t 1 ]]; then
        return 0
    fi
    if [[ -r /dev/tty && -w /dev/tty ]]; then
        return 0
    fi
    return 1
}

bootstrap_gum_temp() {
    GUM=""
    GUM_STATUS="skipped"
    GUM_REASON=""

    if is_non_interactive_shell; then
        GUM_REASON="non-interactive shell (auto-disabled)"
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

    local os arch asset base gum_tmpdir gum_path
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
        GUM_REASON="checksum unavailable or failed"
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

    gum_path="$(find "$gum_tmpdir" -type f -name gum 2>/dev/null | head -n1 || true)"
    if [[ -z "$gum_path" ]]; then
        GUM_REASON="gum binary missing after extract"
        return 1
    fi

    chmod +x "$gum_path" >/dev/null 2>&1 || true
    if [[ ! -x "$gum_path" ]]; then
        GUM_REASON="gum binary is not executable"
        return 1
    fi

    GUM="$gum_path"
    GUM_STATUS="installed"
    GUM_REASON="temp, verified"
    return 0
}

print_gum_status() {
    case "$GUM_STATUS" in
        found)
            ui_success "gum available (${GUM_REASON})"
            ;;
        installed)
            ui_success "gum bootstrapped (${GUM_REASON}, v${GUM_VERSION})"
            ;;
        *)
            if [[ -n "$GUM_REASON" && "$GUM_REASON" != "non-interactive shell (auto-disabled)" ]]; then
                ui_info "gum skipped (${GUM_REASON})"
            fi
            ;;
    esac
}

# ─── Section 3: UI Functions ──────────────────────────────────────────────────

print_installer_banner() {
    if [[ -n "$GUM" ]]; then
        local title tagline hint card
        title="$("$GUM" style --foreground "#6366f1" --bold "⚡ Viben Installer")"
        tagline="$("$GUM" style --foreground "#8892b0" "$TAGLINE")"
        hint="$("$GUM" style --foreground "#5a6480" "installer v${INSTALLER_VERSION}")"
        card="$(printf '%s\n%s\n%s' "$title" "$tagline" "$hint")"
        "$GUM" style --border rounded --border-foreground "#6366f1" --padding "1 2" "$card"
        echo ""
        return
    fi

    echo -e "${ACCENT}${BOLD}"
    echo "  ⚡ Viben Installer"
    echo -e "${NC}${INFO}  ${TAGLINE}${NC}"
    echo -e "${MUTED}  installer v${INSTALLER_VERSION}${NC}"
    echo ""
}

detect_os_or_die() {
    OS="unknown"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
    elif [[ "$OSTYPE" == "linux-gnu"* ]] || [[ -n "${WSL_DISTRO_NAME:-}" ]]; then
        OS="linux"
    fi

    if [[ "$OS" == "unknown" ]]; then
        ui_error "Unsupported operating system"
        echo "This installer supports macOS and Linux (including WSL)."
        exit 1
    fi

    ui_success "Detected: $OS"
}

ui_info() {
    local msg="$*"
    if [[ -n "$GUM" ]]; then
        "$GUM" log --level info "$msg"
    else
        echo -e "${MUTED}·${NC} ${msg}"
    fi
}

ui_warn() {
    local msg="$*"
    if [[ -n "$GUM" ]]; then
        "$GUM" log --level warn "$msg"
    else
        echo -e "${WARN}!${NC} ${msg}"
    fi
}

ui_success() {
    local msg="$*"
    if [[ -n "$GUM" ]]; then
        local mark
        mark="$("$GUM" style --foreground "#22c55e" --bold "✓")"
        echo "${mark} ${msg}"
    else
        echo -e "${SUCCESS}✓${NC} ${msg}"
    fi
}

ui_error() {
    local msg="$*"
    if [[ -n "$GUM" ]]; then
        "$GUM" log --level error "$msg"
    else
        echo -e "${ERROR}✗${NC} ${msg}"
    fi
}

INSTALL_STAGE_TOTAL=3
INSTALL_STAGE_CURRENT=0

ui_section() {
    local title="$1"
    if [[ -n "$GUM" ]]; then
        "$GUM" style --bold --foreground "#6366f1" --padding "1 0" "$title"
    else
        echo ""
        echo -e "${ACCENT}${BOLD}${title}${NC}"
    fi
}

ui_stage() {
    local title="$1"
    INSTALL_STAGE_CURRENT=$((INSTALL_STAGE_CURRENT + 1))
    ui_section "[${INSTALL_STAGE_CURRENT}/${INSTALL_STAGE_TOTAL}] ${title}"
}

ui_kv() {
    local key="$1"
    local value="$2"
    if [[ -n "$GUM" ]]; then
        local key_part value_part
        key_part="$("$GUM" style --foreground "#5a6480" --width 20 "$key")"
        value_part="$("$GUM" style --bold "$value")"
        "$GUM" join --horizontal "$key_part" "$value_part"
    else
        echo -e "${MUTED}${key}:${NC} ${value}"
    fi
}

is_gum_raw_mode_failure() {
    local err_log="$1"
    [[ -s "$err_log" ]] || return 1
    grep -Eiq 'setrawmode' "$err_log"
}

run_with_spinner() {
    local title="$1"
    shift

    if [[ -n "$GUM" ]] && gum_is_tty; then
        local gum_err
        gum_err="$(mktempfile)"
        if "$GUM" spin --spinner dot --title "$title" -- "$@" 2>"$gum_err"; then
            return 0
        fi
        local gum_status=$?
        if is_gum_raw_mode_failure "$gum_err"; then
            GUM=""
            GUM_STATUS="skipped"
            GUM_REASON="gum raw mode unavailable"
            ui_warn "Spinner unavailable in this terminal; continuing without spinner"
            "$@"
            return $?
        fi
        if [[ -s "$gum_err" ]]; then
            cat "$gum_err" >&2
        fi
        return "$gum_status"
    fi

    "$@"
}

run_quiet_step() {
    local title="$1"
    shift

    if [[ "$VERBOSE" == "1" ]]; then
        run_with_spinner "$title" "$@"
        return $?
    fi

    local log
    log="$(mktempfile)"

    if [[ -n "$GUM" ]] && gum_is_tty; then
        local cmd_quoted=""
        local log_quoted=""
        printf -v cmd_quoted '%q ' "$@"
        printf -v log_quoted '%q' "$log"
        if run_with_spinner "$title" bash -c "${cmd_quoted}>${log_quoted} 2>&1"; then
            return 0
        fi
    else
        if "$@" >"$log" 2>&1; then
            return 0
        fi
    fi

    ui_error "${title} failed — re-run with --verbose for details"
    if [[ -s "$log" ]]; then
        tail -n 80 "$log" >&2 || true
    fi
    return 1
}

show_install_plan() {
    ui_section "Install plan"
    ui_kv "OS" "$OS"
    ui_kv "Install method" "$INSTALL_METHOD"
    ui_kv "Requested version" "$INSTALL_TAG"
    if [[ "$INSTALL_METHOD" == "git" ]]; then
        ui_kv "Git directory" "$GIT_DIR"
    fi
    if [[ "$DRY_RUN" == "1" ]]; then
        ui_kv "Dry run" "yes"
    fi
    if [[ "$NO_ONBOARD" == "1" ]]; then
        ui_kv "Onboarding" "skipped"
    fi
}

ui_celebrate() {
    local msg="$1"
    if [[ -n "$GUM" ]]; then
        "$GUM" style --bold --foreground "#22c55e" "$msg"
    else
        echo -e "${SUCCESS}${BOLD}${msg}${NC}"
    fi
}

# ─── Section 4: Argument Parsing ──────────────────────────────────────────────

NO_ONBOARD=${VIBEN_NO_ONBOARD:-0}
NO_PROMPT=${VIBEN_NO_PROMPT:-0}
DRY_RUN=${VIBEN_DRY_RUN:-0}
INSTALL_METHOD=${VIBEN_INSTALL_METHOD:-npm}
INSTALL_TAG=${VIBEN_VERSION:-latest}
GIT_DIR_DEFAULT="${HOME}/Viben"
GIT_DIR=${VIBEN_GIT_DIR:-$GIT_DIR_DEFAULT}
NO_GIT_UPDATE=0
VERBOSE="${VIBEN_VERBOSE:-0}"
DO_VERIFY="${VIBEN_VERIFY_INSTALL:-0}"
HELP=0

print_usage() {
    cat <<EOF
Viben installer (macOS + Linux)

Usage:
  curl -fsSL https://raw.githubusercontent.com/Viben/Viben/main/scripts/install.sh | bash
  curl -fsSL ... | bash -s -- [options]

Options:
  --install-method, --method npm|git  Install via npm (default) or from a git checkout
  --npm                               Shortcut for --install-method npm
  --git                               Shortcut for --install-method git
  --version <version|dist-tag>        npm install target (default: latest)
  --git-dir, --dir <path>            Checkout directory (default: ~/Viben)
  --no-git-update                     Skip git pull for existing checkout
  --no-onboard                        Skip onboarding after install
  --no-prompt                         Disable prompts (CI/automation)
  --verify                            Run a post-install smoke test
  --dry-run                           Print what would happen (no changes)
  --verbose                           Print debug output (set -x)
  --help, -h                          Show this help

Environment variables:
  VIBEN_INSTALL_METHOD=npm|git
  VIBEN_VERSION=latest|<semver>
  VIBEN_GIT_DIR=...
  VIBEN_NO_PROMPT=1
  VIBEN_VERIFY_INSTALL=1
  VIBEN_DRY_RUN=1
  VIBEN_NO_ONBOARD=1
  VIBEN_VERBOSE=1

Examples:
  curl -fsSL https://raw.githubusercontent.com/Viben/Viben/main/scripts/install.sh | bash
  curl -fsSL ... | bash -s -- --no-onboard
  curl -fsSL ... | bash -s -- --version 2026.328.1
  curl -fsSL ... | bash -s -- --install-method git
EOF
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --no-onboard)
                NO_ONBOARD=1
                shift
                ;;
            --dry-run)
                DRY_RUN=1
                shift
                ;;
            --verbose)
                VERBOSE=1
                shift
                ;;
            --verify)
                DO_VERIFY=1
                shift
                ;;
            --no-prompt)
                NO_PROMPT=1
                shift
                ;;
            --help|-h)
                HELP=1
                shift
                ;;
            --install-method|--method)
                INSTALL_METHOD="$2"
                shift 2
                ;;
            --version)
                INSTALL_TAG="$2"
                shift 2
                ;;
            --npm)
                INSTALL_METHOD="npm"
                shift
                ;;
            --git)
                INSTALL_METHOD="git"
                shift
                ;;
            --git-dir|--dir)
                GIT_DIR="$2"
                shift 2
                ;;
            --no-git-update)
                NO_GIT_UPDATE=1
                shift
                ;;
            *)
                shift
                ;;
        esac
    done
}

validate_args() {
    # Validate --git-dir: reject paths with shell-unsafe characters
    if [[ "$GIT_DIR" =~ [\'\"\ \`\$\;\&\|\<\>] ]]; then
        echo "Error: --git-dir contains unsafe characters: $GIT_DIR" >&2
        exit 1
    fi
    if [[ "$GIT_DIR" == *..* ]]; then
        echo "Error: --git-dir must not contain '..': $GIT_DIR" >&2
        exit 1
    fi

    # Validate --version: allow 'latest', 'main', semver (YYYY.MMDD.patch), or simple dist-tag
    if [[ "$INSTALL_TAG" != "latest" && "$INSTALL_TAG" != "main" ]]; then
        if ! [[ "$INSTALL_TAG" =~ ^[a-zA-Z0-9._-]+$ ]]; then
            echo "Error: --version contains invalid characters: $INSTALL_TAG" >&2
            exit 1
        fi
    fi
}

configure_verbose() {
    if [[ "$VERBOSE" != "1" ]]; then
        return 0
    fi
    set -x
}

is_promptable() {
    if [[ "$NO_PROMPT" == "1" ]]; then
        return 1
    fi
    if [[ -r /dev/tty && -w /dev/tty ]]; then
        return 0
    fi
    return 1
}

prompt_choice() {
    local prompt="$1"
    local answer=""
    if ! is_promptable; then
        return 1
    fi
    printf '%b\n' "$prompt" >/dev/tty
    read -r answer </dev/tty || true
    echo "$answer"
}

choose_install_method_interactive() {
    if ! is_promptable; then
        return 1
    fi

    if [[ -n "$GUM" ]] && gum_is_tty; then
        local selection
        selection="$("$GUM" choose \
            --header "Choose install method" \
            --cursor-prefix "❯ " \
            "npm  · install globally via npm (recommended)" \
            "git  · clone and build from source" </dev/tty || true)"

        case "$selection" in
            npm*) echo "npm"; return 0 ;;
            git*) echo "git"; return 0 ;;
        esac
        return 1
    fi

    local choice=""
    choice="$(prompt_choice "$(cat <<EOF
Choose install method:
  1) Install globally via npm (recommended)
  2) Clone and build from source (git)
Enter 1 or 2:
EOF
)" || true)"

    case "$choice" in
        1) echo "npm"; return 0 ;;
        2) echo "git"; return 0 ;;
    esac

    return 1
}

# ─── Section 5: Node.js Detection & Installation ──────────────────────────────

ensure_xcode_clt() {
    if [[ "$OS" != "macos" ]]; then
        return 0
    fi
    if xcode-select -p &>/dev/null 2>&1; then
        return 0
    fi
    ui_info "Xcode Command Line Tools not found — installing..."
    xcode-select --install 2>/dev/null || true
    ui_info "A dialog appeared — click Install and wait for it to complete"
    until xcode-select -p &>/dev/null 2>&1; do
        sleep 5
    done
    ui_success "Xcode Command Line Tools installed"
}

node_major_version() {
    if ! command -v node &>/dev/null; then
        return 1
    fi
    local version major
    version="$(node -v 2>/dev/null || true)"
    major="${version#v}"
    major="${major%%.*}"
    if [[ "$major" =~ ^[0-9]+$ ]]; then
        echo "$major"
        return 0
    fi
    return 1
}

node_is_at_least_required() {
    if ! command -v node &>/dev/null; then
        return 1
    fi
    local version major minor
    version="$(node -v 2>/dev/null || true)"
    major="${version#v}"
    major="${major%%.*}"
    minor="${version#v}"
    minor="${minor#*.}"
    minor="${minor%%.*}"
    if [[ ! "$major" =~ ^[0-9]+$ || ! "$minor" =~ ^[0-9]+$ ]]; then
        return 1
    fi
    if [[ "$major" -gt "$NODE_MIN_MAJOR" ]]; then
        return 0
    fi
    if [[ "$major" -eq "$NODE_MIN_MAJOR" && "$minor" -ge "$NODE_MIN_MINOR" ]]; then
        return 0
    fi
    return 1
}

check_node() {
    if command -v node &>/dev/null; then
        local node_path
        node_path="$(command -v node)"
        if node_is_at_least_required; then
            ui_success "Node.js v$(node -v | cut -d'v' -f2) found (${node_path})"
            return 0
        else
            ui_info "Node.js $(node -v) found at ${node_path}, need v${NODE_MIN_VERSION}+"
            return 1
        fi
    else
        ui_info "Node.js not found, installing it now"
        return 1
    fi
}

ensure_default_node_active_shell() {
    # Always try version managers first (nvm, fnm, nodenv) before falling back to
    # system node. This is important because version-manager-installed node has a
    # user-writable npm prefix, whereas system node (installed via pkg/brew without
    # a version manager) typically uses /usr/local which may require sudo for global
    # installs — even when the node version itself meets the minimum requirement.

    # Try sourcing nvm.
    # Check NVM_DIR first, then fall back to the default ~/.nvm location.
    # The fallback is critical: in non-login shells (e.g. when launched from a
    # GUI app like the Viben desktop), ~/.zshrc is never sourced so NVM_DIR
    # is unset even when nvm is properly installed.
    local nvm_sh=""
    if [[ -n "${NVM_DIR:-}" && -s "${NVM_DIR}/nvm.sh" ]]; then
        nvm_sh="${NVM_DIR}/nvm.sh"
    elif [[ -s "${HOME}/.nvm/nvm.sh" ]]; then
        nvm_sh="${HOME}/.nvm/nvm.sh"
    elif [[ -n "${XDG_CONFIG_HOME:-}" && -s "${XDG_CONFIG_HOME}/nvm/nvm.sh" ]]; then
        nvm_sh="${XDG_CONFIG_HOME}/nvm/nvm.sh"
    fi
    if [[ -n "$nvm_sh" ]]; then
        # shellcheck source=/dev/null
        source "$nvm_sh" 2>/dev/null || true
        if node_is_at_least_required; then
            return 0
        fi
    fi

    # Try sourcing fnm
    if command -v fnm &>/dev/null; then
        eval "$(fnm env 2>/dev/null)" || true
        if node_is_at_least_required; then
            return 0
        fi
    fi

    # Try nodenv
    if command -v nodenv &>/dev/null; then
        eval "$(nodenv init - 2>/dev/null)" || true
        if node_is_at_least_required; then
            return 0
        fi
    fi

    # Fall back to whatever node is already in PATH (system node, Homebrew, etc.)
    if node_is_at_least_required; then
        return 0
    fi

    # Try Homebrew-managed Node (macOS) — covers cases where Homebrew shellenv
    # was not initialized (e.g. non-login shell without ~/.zprofile sourced).
    for brew_bin in "/opt/homebrew/bin" "/usr/local/bin"; do
        if [[ -x "${brew_bin}/node" ]]; then
            export PATH="${brew_bin}:${PATH}"
            hash -r 2>/dev/null || true
            if node_is_at_least_required; then
                return 0
            fi
        fi
    done

    return 1
}

print_nvm_upgrade_hint() {
    echo "nvm appears to be managing Node for this shell."
    echo "Run:"
    echo "  nvm install ${NODE_DEFAULT_MAJOR}"
    echo "  nvm use ${NODE_DEFAULT_MAJOR}"
    echo "  nvm alias default ${NODE_DEFAULT_MAJOR}"
    echo "Then open a new shell and rerun the installer."
}

# Ensure nvm init lines are present in all relevant shell config files.
# nvm's own installer only writes based on $SHELL, which may miss some configs.
# On macOS the primary shell is zsh — always patch ~/.zshrc regardless of other rc files.
patch_nvm_shell_configs() {
    # shellcheck disable=SC2016
    local nvm_init_lines
    nvm_init_lines="$(cat <<'EOF'
export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
EOF
)"
    local marker='nvm.sh'

    patch_rc() {
        local rc="$1"
        if ! grep -q "$marker" "$rc" 2>/dev/null; then
            printf '\n# nvm (Node Version Manager)\n%s\n' "$nvm_init_lines" >> "$rc"
            ui_info "Added nvm init to $rc"
        fi
    }

    if [[ "$OS" == "macos" ]]; then
        # macOS default shell is zsh. On a fresh machine ~/.zshrc may not exist yet —
        # nvm installer only appends to existing files, so we must ensure ~/.zshrc exists.
        touch "$HOME/.zshrc"
        patch_rc "$HOME/.zshrc"
        # Also patch bash configs if they exist.
        # Use if/then instead of [[ ]] && to avoid triggering set -e when the file
        # doesn't exist (which is common on fresh macOS machines).
        for rc in "$HOME/.bashrc" "$HOME/.bash_profile"; do
            if [[ -f "$rc" ]]; then
                patch_rc "$rc"
            fi
        done
    else
        # Linux: patch whichever rc files exist; create ~/.bashrc if none present
        local patched_any=0
        for rc in "$HOME/.zshrc" "$HOME/.bashrc" "$HOME/.bash_profile"; do
            if [[ -f "$rc" ]]; then
                patch_rc "$rc"
                patched_any=1
            fi
        done
        if [[ "$patched_any" -eq 0 ]]; then
            printf '# nvm (Node Version Manager)\n%s\n' "$nvm_init_lines" > "$HOME/.bashrc"
            ui_info "Created ~/.bashrc with nvm init"
        fi
    fi
}

install_node() {
    if [[ "$OS" == "macos" ]]; then
        ensure_xcode_clt
        # Install via nvm (no sudo required)
        if [[ -z "${NVM_DIR:-}" ]] && [[ ! -s "${HOME}/.nvm/nvm.sh" ]] && [[ ! -s "${XDG_CONFIG_HOME:-}/nvm/nvm.sh" ]]; then
            ui_info "Installing nvm (Node Version Manager)"
            local nvm_install
            nvm_install="$(mktempfile)"
            download_file "https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh" "$nvm_install"
            run_quiet_step "Installing nvm" bash "$nvm_install"
            export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")"
            # shellcheck source=/dev/null
            # Use || true: source nvm.sh may exit non-zero via nvm_auto when no
            # node versions are installed yet; that's expected at this stage.
            [[ -s "${NVM_DIR}/nvm.sh" ]] && source "${NVM_DIR}/nvm.sh" || true
            patch_nvm_shell_configs
        fi

        if [[ -s "${NVM_DIR:-${HOME}/.nvm}/nvm.sh" ]]; then
            # shellcheck source=/dev/null
            source "${NVM_DIR:-${HOME}/.nvm}/nvm.sh" || true
            ui_info "Installing Node.js v${NODE_DEFAULT_MAJOR} via nvm"
            run_quiet_step "Installing Node.js" nvm install "${NODE_DEFAULT_MAJOR}"
            nvm use "${NODE_DEFAULT_MAJOR}" 2>/dev/null || true
            nvm alias default "${NODE_DEFAULT_MAJOR}" 2>/dev/null || true
        else
            ui_error "Could not install nvm. Please install Node.js ${NODE_DEFAULT_MAJOR} manually: https://nodejs.org"
            exit 1
        fi

        # Always ensure shell configs are patched (idempotent) — handles the case where
        # nvm was already installed but ~/.zshrc didn't exist at that time.
        patch_nvm_shell_configs

        ui_success "Node.js v${NODE_DEFAULT_MAJOR} installed"

    elif [[ "$OS" == "linux" ]]; then
        # Check for nvm first, install it if not present.
        # Note: nvm is a shell function, not a binary — command -v nvm is unreliable.
        # Always detect nvm via NVM_DIR / nvm.sh presence.
        if [[ -z "${NVM_DIR:-}" ]] && [[ ! -s "${HOME}/.nvm/nvm.sh" ]] && [[ ! -s "${XDG_CONFIG_HOME:-}/nvm/nvm.sh" ]]; then
            ui_info "Installing nvm (Node Version Manager)"
            local nvm_install
            nvm_install="$(mktempfile)"
            download_file "https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh" "$nvm_install"
            run_quiet_step "Installing nvm" bash "$nvm_install"
            export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")"
            # shellcheck source=/dev/null
            [[ -s "${NVM_DIR}/nvm.sh" ]] && source "${NVM_DIR}/nvm.sh" || true
            patch_nvm_shell_configs
        fi

        if [[ -n "${NVM_DIR:-}" && -s "${NVM_DIR}/nvm.sh" ]] || [[ -s "${HOME}/.nvm/nvm.sh" ]]; then
            # shellcheck source=/dev/null
            [[ -s "${NVM_DIR:-${HOME}/.nvm}/nvm.sh" ]] && source "${NVM_DIR:-${HOME}/.nvm}/nvm.sh" || true
            ui_info "Installing Node.js v${NODE_DEFAULT_MAJOR} via nvm"
            run_quiet_step "Installing Node.js" nvm install "${NODE_DEFAULT_MAJOR}"
            nvm use "${NODE_DEFAULT_MAJOR}" 2>/dev/null || true
            nvm alias default "${NODE_DEFAULT_MAJOR}" 2>/dev/null || true
        else
            # Fallback: NodeSource
            # Security note: NodeSource setup scripts are downloaded over TLS (--proto '=https'
            # --tlsv1.2 enforced by download_file) and executed directly. NodeSource does not
            # publish per-script SHA256 checksums, so content verification is not possible.
            # This is the same accepted pattern used by Homebrew, Rust, and other major installers.
            # Source: https://github.com/nodesource/distributions
            ui_info "Installing Node.js via NodeSource"
            require_sudo
            if command -v apt-get &>/dev/null; then
                local tmp
                tmp="$(mktempfile)"
                download_file "https://deb.nodesource.com/setup_${NODE_DEFAULT_MAJOR}.x" "$tmp"
                if is_root; then
                    run_quiet_step "Configuring NodeSource" bash "$tmp"
                    run_quiet_step "Installing Node.js" apt-get install -y -qq nodejs
                else
                    run_quiet_step "Configuring NodeSource" sudo -E bash "$tmp"
                    run_quiet_step "Installing Node.js" sudo apt-get install -y -qq nodejs
                fi
            elif command -v dnf &>/dev/null; then
                local tmp
                tmp="$(mktempfile)"
                download_file "https://rpm.nodesource.com/setup_${NODE_DEFAULT_MAJOR}.x" "$tmp"
                if is_root; then
                    run_quiet_step "Configuring NodeSource" bash "$tmp"
                    run_quiet_step "Installing Node.js" dnf install -y -q nodejs
                else
                    run_quiet_step "Configuring NodeSource" sudo bash "$tmp"
                    run_quiet_step "Installing Node.js" sudo dnf install -y -q nodejs
                fi
            elif command -v yum &>/dev/null; then
                local tmp
                tmp="$(mktempfile)"
                download_file "https://rpm.nodesource.com/setup_${NODE_DEFAULT_MAJOR}.x" "$tmp"
                if is_root; then
                    run_quiet_step "Configuring NodeSource" bash "$tmp"
                    run_quiet_step "Installing Node.js" yum install -y -q nodejs
                else
                    run_quiet_step "Configuring NodeSource" sudo bash "$tmp"
                    run_quiet_step "Installing Node.js" sudo yum install -y -q nodejs
                fi
            elif command -v pacman &>/dev/null; then
                if is_root; then
                    run_quiet_step "Installing Node.js" pacman -Sy --noconfirm nodejs npm
                else
                    run_quiet_step "Installing Node.js" sudo pacman -Sy --noconfirm nodejs npm
                fi
            else
                ui_error "Could not detect package manager"
                echo "Please install Node.js ${NODE_DEFAULT_MAJOR} manually: https://nodejs.org"
                exit 1
            fi
        fi

        # Always ensure shell configs are patched (idempotent)
        if [[ -s "${HOME}/.nvm/nvm.sh" ]] || [[ -s "${NVM_DIR:-}/nvm.sh" ]]; then
            patch_nvm_shell_configs
        fi

        ui_success "Node.js v${NODE_DEFAULT_MAJOR} installed"
    fi
}

# ─── Section 6: Git, npm Permissions & Package Install ────────────────────────

check_git() {
    if command -v git &>/dev/null; then
        ui_success "Git already installed"
        return 0
    fi
    ui_info "Git not found, installing it now"
    return 1
}

is_root() {
    [[ "$(id -u)" -eq 0 ]]
}

maybe_sudo() {
    if is_root; then
        if [[ "${1:-}" == "-E" ]]; then
            shift
        fi
        "$@"
    else
        sudo "$@"
    fi
}

require_sudo() {
    if [[ "$OS" != "linux" ]]; then
        return 0
    fi
    if is_root; then
        return 0
    fi
    if command -v sudo &>/dev/null; then
        if ! sudo -n true >/dev/null 2>&1; then
            ui_info "Administrator privileges required; enter your password"
            sudo -v
        fi
        return 0
    fi
    ui_error "sudo is required for system installs on Linux"
    echo "  Install sudo or re-run as root."
    exit 1
}

install_git() {
    if [[ "$OS" == "macos" ]]; then
        if ! command -v brew &>/dev/null; then
            ui_info "Installing Git via Xcode Command Line Tools"
            xcode-select --install 2>/dev/null || true
            ui_info "If prompted, complete the Xcode CLT install, then rerun this installer"
        else
            run_quiet_step "Installing Git" brew install git
        fi
    elif [[ "$OS" == "linux" ]]; then
        require_sudo
        if command -v apt-get &>/dev/null; then
            if is_root; then
                run_quiet_step "Updating package index" apt-get update -qq
                run_quiet_step "Installing Git" apt-get install -y -qq git
            else
                run_quiet_step "Updating package index" sudo apt-get update -qq
                run_quiet_step "Installing Git" sudo apt-get install -y -qq git
            fi
        elif command -v pacman &>/dev/null; then
            if is_root; then
                run_quiet_step "Installing Git" pacman -Sy --noconfirm git
            else
                run_quiet_step "Installing Git" sudo pacman -Sy --noconfirm git
            fi
        elif command -v dnf &>/dev/null; then
            if is_root; then
                run_quiet_step "Installing Git" dnf install -y -q git
            else
                run_quiet_step "Installing Git" sudo dnf install -y -q git
            fi
        elif command -v yum &>/dev/null; then
            if is_root; then
                run_quiet_step "Installing Git" yum install -y -q git
            else
                run_quiet_step "Installing Git" sudo yum install -y -q git
            fi
        else
            ui_error "Could not detect package manager for Git"
            exit 1
        fi
    fi
    ui_success "Git installed"
}

fix_npm_permissions() {
    local npm_prefix
    npm_prefix="$(npm config get prefix 2>/dev/null || true)"
    if [[ -z "$npm_prefix" ]]; then
        return 0
    fi

    # Check if npm global installs would succeed by verifying write access to the
    # node_modules directory specifically. Checking $prefix or $prefix/lib alone is
    # not sufficient: on Intel Macs with Homebrew, /usr/local/lib is user-writable
    # (Homebrew sets this up) but /usr/local/lib/node_modules may be owned by root
    # if Node was previously installed via the official pkg installer.
    local nm_dir="$npm_prefix/lib/node_modules"
    if [[ -d "$nm_dir" && -w "$nm_dir" ]]; then
        return 0
    fi
    if [[ ! -d "$nm_dir" && -w "$npm_prefix/lib" ]]; then
        return 0
    fi

    ui_info "Configuring npm for user-local installs"
    mkdir -p "$HOME/.npm-global"
    npm config set prefix "$HOME/.npm-global"

    # shellcheck disable=SC2016
    local path_line='export PATH="$HOME/.npm-global/bin:$PATH"'
    for rc in "$HOME/.bashrc" "$HOME/.zshrc"; do
        if [[ -f "$rc" ]] && ! grep -q ".npm-global" "$rc"; then
            echo "$path_line" >> "$rc"
        fi
    done

    export PATH="$HOME/.npm-global/bin:$PATH"
    ui_success "npm configured for user installs"
}

resolve_package_install_spec() {
    local value="$1"
    if [[ "$value" == "latest" ]]; then
        echo "@viben/kernel@latest"
        return 0
    fi
    echo "@viben/kernel@${value}"
}

install_viben_npm() {
    local spec="$1"
    local log
    log="$(mktempfile)"
    local max_retries=3
    local attempt=0

    # If viben already exists in the current PATH, upgrade it in-place using
    # the npm that belongs to the same node installation. This prevents creating
    # a duplicate binary under a different node prefix (e.g. Homebrew vs nvm)
    # when the user's active node differs from the one that originally installed viben.
    local existing_bin
    existing_bin="$(command -v viben 2>/dev/null || true)"
    if [[ -n "$existing_bin" && -x "$existing_bin" ]]; then
        local bin_dir
        bin_dir="$(dirname "$existing_bin")"
        if [[ -x "${bin_dir}/npm" ]]; then
            ui_info "Found existing viben at ${existing_bin} — upgrading in place"
            local -a upgrade_cmd=("${bin_dir}/npm" install -g --no-fund --no-audit "$spec")
            if "${upgrade_cmd[@]}" >"$log" 2>&1; then
                ui_success "Viben upgraded"
                return 0
            fi
            ui_warn "In-place upgrade failed, falling through to standard install"
        fi
    fi

    while [[ "$attempt" -lt "$max_retries" ]]; do
        attempt=$((attempt + 1))

        local -a cmd=(npm install -g --no-fund --no-audit "$spec")
        if [[ "$VERBOSE" == "1" ]]; then
            if "${cmd[@]}" 2>&1 | tee "$log"; then
                ui_success "Viben npm package installed"
                return 0
            fi
        else
            if [[ -n "$GUM" ]] && gum_is_tty; then
                local cmd_quoted="" log_quoted=""
                printf -v cmd_quoted '%q ' "${cmd[@]}"
                printf -v log_quoted '%q' "$log"
                if run_with_spinner "Installing Viben (attempt ${attempt}/${max_retries})" bash -c "${cmd_quoted}>${log_quoted} 2>&1"; then
                    ui_success "Viben npm package installed"
                    return 0
                fi
            else
                if "${cmd[@]}" >"$log" 2>&1; then
                    ui_success "Viben npm package installed"
                    return 0
                fi
            fi
        fi

        if [[ "$attempt" -lt "$max_retries" ]]; then
            ui_warn "npm install failed (attempt ${attempt}/${max_retries}); retrying..."
            sleep 2
        fi
    done

    ui_error "npm install failed after ${max_retries} attempts"
    ui_warn "Command: npm install -g ${spec}"
    if [[ -s "$log" ]]; then
        echo "  Last log lines:"
        tail -n 20 "$log" >&2 || true
    fi
    return 1
}

install_viben_from_git() {
    local repo_dir="$1"
    local repo_url="https://github.com/LinXueyuanStdio/viben.git"

    if [[ -d "$repo_dir/.git" ]]; then
        ui_info "Installing Viben from git checkout: ${repo_dir}"
    else
        ui_info "Installing Viben from GitHub (${repo_url})"
    fi

    if ! check_git; then
        install_git
        if ! command -v git &>/dev/null; then
            ui_error "Git installation failed. Please install git manually and rerun."
            exit 1
        fi
        hash -r 2>/dev/null || true
    fi

    # Ensure pnpm is available
    if ! command -v pnpm &>/dev/null; then
        ui_info "Installing pnpm"
        if command -v corepack &>/dev/null; then
            corepack enable >/dev/null 2>&1 || true
            corepack prepare pnpm@latest --activate >/dev/null 2>&1 || true
            hash -r 2>/dev/null || true
        fi
        if ! command -v pnpm &>/dev/null; then
            run_quiet_step "Installing pnpm" npm install -g pnpm
            hash -r 2>/dev/null || true
        fi
    fi
    ui_success "pnpm ready"

    if [[ ! -d "$repo_dir" ]]; then
        run_quiet_step "Cloning Viben" git clone "$repo_url" "$repo_dir"
    fi

    if [[ "$NO_GIT_UPDATE" != "1" ]]; then
        if [[ -z "$(git -C "$repo_dir" status --porcelain 2>/dev/null || true)" ]]; then
            run_quiet_step "Updating repository" git -C "$repo_dir" pull --rebase || true
        else
            ui_info "Repo has local changes; skipping git pull"
        fi
    fi

    run_quiet_step "Installing dependencies" pnpm -C "$repo_dir" install
    run_quiet_step "Building Viben" pnpm -C "$repo_dir" build

    # Create wrapper script
    ensure_user_local_bin_on_path

    # Write wrapper using printf to safely handle any special chars in repo_dir
    printf '#!/usr/bin/env bash\nset -euo pipefail\nexec node %q/dist/cli.js "$@"\n' \
        "$repo_dir" >"$HOME/.local/bin/viben"
    chmod +x "$HOME/.local/bin/viben"
    ui_success "Viben wrapper installed to ~/.local/bin/viben"
}

# ─── Section 7: PATH Management & Verification ────────────────────────────────

ensure_user_local_bin_on_path() {
    local target="$HOME/.local/bin"
    mkdir -p "$target"
    export PATH="$target:$PATH"

    # shellcheck disable=SC2016
    local path_line='export PATH="$HOME/.local/bin:$PATH"'
    for rc in "$HOME/.bashrc" "$HOME/.zshrc"; do
        if [[ -f "$rc" ]] && ! grep -q ".local/bin" "$rc"; then
            echo "$path_line" >> "$rc"
        fi
    done
}

npm_global_bin_dir() {
    local prefix=""
    prefix="$(npm prefix -g 2>/dev/null || true)"
    if [[ -n "$prefix" && "$prefix" == /* ]]; then
        echo "${prefix%/}/bin"
        return 0
    fi
    prefix="$(npm config get prefix 2>/dev/null || true)"
    if [[ -n "$prefix" && "$prefix" != "undefined" && "$prefix" != "null" && "$prefix" == /* ]]; then
        echo "${prefix%/}/bin"
        return 0
    fi
    echo ""
    return 1
}

ensure_npm_global_bin_on_path() {
    local bin_dir=""
    bin_dir="$(npm_global_bin_dir || true)"
    if [[ -n "$bin_dir" ]]; then
        export PATH="${bin_dir}:$PATH"
    fi
}

refresh_shell_command_cache() {
    hash -r 2>/dev/null || true
}

resolve_viben_bin() {
    refresh_shell_command_cache
    local resolved=""
    resolved="$(type -P viben 2>/dev/null || true)"
    if [[ -n "$resolved" && -x "$resolved" ]]; then
        echo "$resolved"
        return 0
    fi

    ensure_npm_global_bin_on_path
    refresh_shell_command_cache
    resolved="$(type -P viben 2>/dev/null || true)"
    if [[ -n "$resolved" && -x "$resolved" ]]; then
        echo "$resolved"
        return 0
    fi

    local npm_bin=""
    npm_bin="$(npm_global_bin_dir || true)"
    if [[ -n "$npm_bin" && -x "${npm_bin}/viben" ]]; then
        echo "${npm_bin}/viben"
        return 0
    fi

    echo ""
    return 1
}

verify_installation() {
    if [[ "${DO_VERIFY}" != "1" ]]; then
        return 0
    fi

    ui_info "Verifying installation..."
    local bin=""
    bin="$(resolve_viben_bin || true)"
    if [[ -z "$bin" ]]; then
        ui_error "Verification failed: viben not found on PATH"
        return 1
    fi

    local version_output=""
    version_output="$("$bin" --version 2>/dev/null || true)"
    if [[ -n "$version_output" ]]; then
        ui_success "Verified: viben ${version_output}"
        return 0
    fi
    ui_error "Verification failed: viben --version returned empty"
    return 1
}

# ─── Section 8: Taglines & Main ───────────────────────────────────────────────

TAGLINES=()
TAGLINES+=("AI coding agents, anywhere.")
TAGLINES+=("Your agents. Your chat. Your rules.")
TAGLINES+=("From chat to code in seconds.")
TAGLINES+=("Talk to your codebase from anywhere.")
TAGLINES+=("One bridge, every platform.")
TAGLINES+=("Agents assembled. Ready to code.")
TAGLINES+=("Your terminal just got a lot smarter.")
TAGLINES+=("Send a message. The agent writes code.")
TAGLINES+=("Code from Telegram. Review from Slack. Ship from Discord.")
TAGLINES+=("The open bridge for AI coding agents.")

pick_tagline() {
    local count=${#TAGLINES[@]}
    if [[ "$count" -eq 0 ]]; then
        echo "$DEFAULT_TAGLINE"
        return
    fi
    if [[ -n "${VIBEN_TAGLINE_INDEX:-}" && "${VIBEN_TAGLINE_INDEX}" =~ ^[0-9]+$ ]]; then
        local idx=$((VIBEN_TAGLINE_INDEX % count))
        echo "${TAGLINES[$idx]}"
        return
    fi
    local idx=$((RANDOM % count))
    echo "${TAGLINES[$idx]}"
}

TAGLINE=$(pick_tagline)

warn_path_missing() {
    local dir="${1%/}"
    local label="$2"
    if [[ -z "$dir" ]]; then
        return 0
    fi
    # Skip if already present in the original PATH (before nvm/npm were loaded)
    case ":${ORIGINAL_PATH}:" in
        *":${dir}:"*) return 0 ;;
    esac
    # Also skip if this dir is inside the nvm prefix — nvm adds itself to PATH via
    # shell rc files automatically, so no manual PATH fix is needed.
    if [[ -n "${NVM_DIR:-}" && "$dir" == "${NVM_DIR}"* ]]; then
        return 0
    fi
    if [[ "$dir" == "${HOME}/.nvm"* ]]; then
        return 0
    fi

    echo ""
    ui_warn "PATH missing ${label}: ${dir}"
    echo "  This can make viben show as \"command not found\" in new terminals."
    echo "  Fix (zsh: ~/.zshrc, bash: ~/.bashrc):"
    echo "    export PATH=\"${dir}:\$PATH\""
}

main() {
    if [[ "$HELP" == "1" ]]; then
        print_usage
        return 0
    fi

    bootstrap_gum_temp || true
    print_installer_banner
    print_gum_status
    detect_os_or_die

    if [[ "$INSTALL_METHOD" != "npm" && "$INSTALL_METHOD" != "git" ]]; then
        ui_error "Invalid --install-method: ${INSTALL_METHOD}"
        echo "Use: --install-method npm|git"
        exit 2
    fi

    show_install_plan

    if [[ "$DRY_RUN" == "1" ]]; then
        ui_success "Dry run complete (no changes made)"
        return 0
    fi

    # ── Stage 1: Prepare environment ──
    ui_stage "Preparing environment"

    # Attempt to activate an existing node installation (e.g. via nvm, fnm, nodenv,
    # or Homebrew) before checking whether node is present. This is necessary because
    # the script may run in a non-login shell (e.g. launched from a GUI app) where
    # shell rc files are never sourced and PATH-based node managers are invisible.
    # If activation fails silently here that is fine — check_node / install_node below
    # will handle the missing-node case.
    ensure_default_node_active_shell 2>/dev/null || true

    if ! check_node; then
        install_node
    fi
    if ! ensure_default_node_active_shell; then
        local active_path active_version
        active_path="$(command -v node 2>/dev/null || echo "not found")"
        active_version="$(node -v 2>/dev/null || echo "missing")"
        ui_error "Node.js v${NODE_MIN_VERSION}+ required but found ${active_version} (${active_path})"

        if [[ -n "${NVM_DIR:-}" ]] || [[ -s "${HOME}/.nvm/nvm.sh" ]]; then
            print_nvm_upgrade_hint
        else
            echo "Install Node.js ${NODE_DEFAULT_MAJOR}+ and ensure it is first on PATH, then rerun."
        fi
        exit 1
    fi

    # ── Stage 2: Install ──
    ui_stage "Installing Viben"

    # Fix npm permissions before any npm global install, regardless of install method.
    # Both "npm" and "git" paths may call `npm install -g` (pnpm, viben).
    fix_npm_permissions

    if [[ "$INSTALL_METHOD" == "git" ]]; then
        if ! check_git; then
            install_git
            if ! command -v git &>/dev/null; then
                ui_error "Git installation failed. Please install git manually and rerun."
                exit 1
            fi
            hash -r 2>/dev/null || true
        fi
        install_viben_from_git "$GIT_DIR"
    else
        local install_spec=""
        install_spec="$(resolve_package_install_spec "$INSTALL_TAG")"
        install_viben_npm "$install_spec"
    fi

    # ── Stage 3: Finalize ──
    ui_stage "Finalizing"

    local VIBEN_BIN=""
    VIBEN_BIN="$(resolve_viben_bin || true)"

    if [[ "$INSTALL_METHOD" == "npm" ]]; then
        local npm_bin=""
        npm_bin="$(npm_global_bin_dir || true)"
        warn_path_missing "$npm_bin" "npm global bin dir"
    fi
    if [[ "$INSTALL_METHOD" == "git" ]]; then
        warn_path_missing "$HOME/.local/bin" "user-local bin dir (~/.local/bin)"
    fi

    if ! verify_installation; then
        exit 1
    fi

    # ── Celebrate ──
    local installed_version=""
    if [[ -n "$VIBEN_BIN" ]]; then
        installed_version="$("$VIBEN_BIN" --version 2>/dev/null || true)"
    fi

    echo ""
    if [[ -n "$installed_version" ]]; then
        ui_celebrate "⚡ Viben installed successfully (${installed_version})!"
    else
        ui_celebrate "⚡ Viben installed successfully!"
    fi

    local messages=(
        "Your agents are ready to chat. Let's go."
        "Bridging the gap between AI and humans, one message at a time."
        "All set. Time to connect your first agent."
        "Installation complete. Your messaging platforms await."
        "Ready to roll. Run viben to get started."
    )
    local msg="${messages[RANDOM % ${#messages[@]}]}"
    echo -e "${MUTED}${msg}${NC}"
    echo ""

    if [[ "$INSTALL_METHOD" == "git" ]]; then
        ui_section "Source install details"
        ui_kv "Checkout" "$GIT_DIR"
        ui_kv "Wrapper" "$HOME/.local/bin/viben"
    fi

    # If nvm was used to install Node, the current shell session doesn't have nvm sourced yet.
    # Instruct user to open a new terminal (the simplest and most reliable approach).
    if [[ -s "${NVM_DIR:-${HOME}/.nvm}/nvm.sh" ]]; then
        echo ""
        ui_warn "Open a new terminal tab/window before running viben"
        echo "  (nvm needs to be loaded, which happens automatically in new terminals)"
    fi

    if [[ "$NO_ONBOARD" != "1" ]]; then
        if [[ -n "$VIBEN_BIN" && -r /dev/tty && -w /dev/tty ]]; then
            ui_info "Starting setup wizard..."
            echo ""
            exec </dev/tty
            exec "$VIBEN_BIN"
        else
            ui_info "Then run: viben"
        fi
    else
        ui_info "Then run: viben"
    fi
}

if [[ "${VIBEN_INSTALL_SH_NO_RUN:-0}" != "1" ]]; then
    parse_args "$@"
    validate_args
    configure_verbose
    main
fi
