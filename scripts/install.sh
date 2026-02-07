#!/usr/bin/env bash
#
# Viben CLI Installer
# https://github.com/LinXueyuanStdio/viben
#
# Usage:
#   curl -fsSL https://github.com/LinXueyuanStdio/viben/releases/latest/download/install.sh | bash
#
# This script installs the viben npm package globally.
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Configuration
NPM_PACKAGE="viben"
BRAND_NAME="Viben"
MIN_NODE_VERSION="18"
GITHUB_REPO="LinXueyuanStdio/viben"

# -----------------------------------------------------------------------------
# Helper functions
# -----------------------------------------------------------------------------

print_banner() {
    echo ""
    echo -e "${CYAN}${BOLD}"
    echo "  ╦  ╦╦╔╗ ╔═╗╔╗╔"
    echo "  ╚╗╔╝║╠╩╗║╣ ║║║"
    echo "   ╚╝ ╩╚═╝╚═╝╝╚╝"
    echo -e "${NC}"
    echo -e "  ${BOLD}${BRAND_NAME} CLI Installer${NC}"
    echo ""
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if a command exists
command_exists() {
    command -v "$1" &> /dev/null
}

# Get Node.js version as major number
get_node_version() {
    local node_cmd="$1"
    "$node_cmd" -v 2>/dev/null | sed 's/v//' | cut -d. -f1 || echo "0"
}

# Detect operating system
detect_os() {
    local os=""
    case "$(uname -s)" in
        Darwin*)
            os="macos"
            ;;
        Linux*)
            os="linux"
            ;;
        MINGW*|MSYS*|CYGWIN*)
            os="windows"
            ;;
        *)
            os="unknown"
            ;;
    esac
    echo "$os"
}

# Detect architecture
detect_arch() {
    local arch=""
    case "$(uname -m)" in
        x86_64|amd64)
            arch="x86_64"
            ;;
        arm64|aarch64)
            arch="arm64"
            ;;
        *)
            arch="unknown"
            ;;
    esac
    echo "$arch"
}

# Find suitable Node.js command
find_node() {
    local node_cmd=""
    local version=""

    if command_exists node; then
        version=$(get_node_version "node")
        if [ "$version" -ge "$MIN_NODE_VERSION" ]; then
            node_cmd="node"
        fi
    fi

    echo "$node_cmd"
}

# Show help message
show_help() {
    echo "Usage: install.sh [OPTIONS]"
    echo ""
    echo "${BRAND_NAME} CLI Installer"
    echo ""
    echo "This script installs the viben npm package globally."
    echo ""
    echo "Options:"
    echo "  -h, --help        Show this help message"
    echo "  --no-confirm      Skip confirmation prompts"
    echo ""
    echo "Requirements:"
    echo "  Node.js ${MIN_NODE_VERSION}+ with npm"
    echo ""
    echo "Examples:"
    echo "  # Default installation"
    echo "  curl -fsSL https://github.com/${GITHUB_REPO}/releases/latest/download/install.sh | bash"
    echo ""
    echo "  # Skip confirmation"
    echo "  curl -fsSL https://github.com/${GITHUB_REPO}/releases/latest/download/install.sh | bash -s -- --no-confirm"
    echo ""
    echo "More information: https://github.com/${GITHUB_REPO}"
}

# -----------------------------------------------------------------------------
# npm installation
# -----------------------------------------------------------------------------

install_npm_package() {
    info "Installing ${NPM_PACKAGE} using npm..."

    # Try npm global install
    if npm install -g "$NPM_PACKAGE" 2>/dev/null; then
        return 0
    fi

    # Try with sudo if permission denied
    warn "Permission denied, trying with sudo..."
    if sudo npm install -g "$NPM_PACKAGE" 2>/dev/null; then
        return 0
    fi

    return 1
}

install_with_pnpm() {
    info "Installing ${NPM_PACKAGE} using pnpm..."
    if pnpm add -g "$NPM_PACKAGE"; then
        return 0
    fi
    return 1
}

install_with_yarn() {
    info "Installing ${NPM_PACKAGE} using yarn..."
    if yarn global add "$NPM_PACKAGE"; then
        return 0
    fi
    return 1
}

install_with_bun() {
    info "Installing ${NPM_PACKAGE} using bun..."
    if bun install -g "$NPM_PACKAGE"; then
        return 0
    fi
    return 1
}

install_node_package() {
    # Try different package managers in order of preference
    if command_exists npm; then
        if install_npm_package; then
            return 0
        fi
    fi

    if command_exists pnpm; then
        if install_with_pnpm; then
            return 0
        fi
    fi

    if command_exists yarn; then
        if install_with_yarn; then
            return 0
        fi
    fi

    if command_exists bun; then
        if install_with_bun; then
            return 0
        fi
    fi

    return 1
}

verify_installation() {
    info "Verifying installation..."

    # Check if viben command is available
    if command_exists viben; then
        success "viben command is available"
        return 0
    fi

    # Check in common global npm locations
    for path in "$HOME/.npm-global/bin/viben" "/usr/local/bin/viben" "$HOME/.local/share/pnpm/viben"; do
        if [ -x "$path" ]; then
            success "viben installed at $path"
            warn "You may need to add this directory to your PATH"
            return 0
        fi
    done

    return 1
}

# -----------------------------------------------------------------------------
# Post-installation instructions
# -----------------------------------------------------------------------------

print_instructions() {
    echo ""
    echo -e "${GREEN}${BOLD}Installation complete!${NC}"
    echo ""
    echo "Quick start:"
    echo ""
    echo "  # Initialize a workspace"
    echo "  viben init"
    echo ""
    echo "  # List configuration"
    echo "  viben config list"
    echo ""
    echo "  # Manage agents"
    echo "  viben agent list"
    echo ""
    echo "  # Start MCP server (auto-installs browse-mcp if needed)"
    echo "  viben serve"
    echo ""
    echo "Documentation: https://github.com/${GITHUB_REPO}"
    echo ""
}

print_path_instructions() {
    local os="$1"

    echo ""
    warn "The viben command may not be in your PATH."
    echo ""
    echo "Add the npm global bin directory to your PATH:"
    echo ""
    echo '  export PATH="$(npm config get prefix)/bin:$PATH"'
    echo ""
    echo "Add this line to your shell profile (~/.bashrc, ~/.zshrc, etc.)"
    echo ""
}

# -----------------------------------------------------------------------------
# Main installation logic
# -----------------------------------------------------------------------------

main() {
    local no_confirm=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            --no-confirm)
                no_confirm=true
                shift
                ;;
            *)
                error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done

    print_banner

    # Detect system
    local os
    local arch
    os=$(detect_os)
    arch=$(detect_arch)

    info "Detected OS: $os ($arch)"

    # Check for WSL on Windows
    if [ "$os" = "windows" ]; then
        warn "Native Windows is not fully supported."
        warn "We recommend using WSL (Windows Subsystem for Linux)."
        echo ""
    fi

    # Check Node.js
    local node_cmd
    node_cmd=$(find_node)
    if [ -z "$node_cmd" ]; then
        error "Node.js ${MIN_NODE_VERSION}+ is required but not found."
        echo ""
        echo "Please install Node.js:"
        case "$os" in
            macos)
                echo "  brew install node"
                echo "  # or download from https://nodejs.org/"
                ;;
            linux)
                echo "  # Ubuntu/Debian:"
                echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
                echo "  sudo apt-get install -y nodejs"
                echo ""
                echo "  # Or use nvm:"
                echo "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
                echo "  nvm install 20"
                ;;
            *)
                echo "  Download from https://nodejs.org/"
                ;;
        esac
        exit 1
    fi

    local node_version
    node_version=$(get_node_version "$node_cmd")
    success "Found Node.js v$node_version"

    # Check for package manager
    if ! command_exists npm && ! command_exists pnpm && ! command_exists yarn && ! command_exists bun; then
        error "No package manager found (npm, pnpm, yarn, or bun required)"
        exit 1
    fi

    # Confirm installation
    if [ "$no_confirm" = false ]; then
        echo ""
        echo "This will install:"
        echo "  - ${NPM_PACKAGE} (npm package) - Viben CLI"
        echo ""
        read -r -p "Continue? [Y/n] " response
        case "$response" in
            [nN][oO]|[nN])
                echo "Installation cancelled."
                exit 0
                ;;
        esac
    fi

    echo ""

    # Install the package
    if install_node_package; then
        success "Package installed successfully"
    else
        error "Installation failed"
        echo ""
        echo "Try manual installation:"
        echo "  npm install -g ${NPM_PACKAGE}"
        exit 1
    fi

    echo ""

    # Verify installation
    if verify_installation; then
        print_instructions
    else
        warn "Installation completed but verification failed"
        print_path_instructions "$os"
    fi
}

# Run main function
main "$@"
