#!/usr/bin/env bash
#
# Viben CLI Installer
# https://github.com/LinXueyuanStdio/viben
#
# Usage:
#   curl -fsSL https://github.com/LinXueyuanStdio/viben/releases/latest/download/install.sh | bash
#
# This script installs the browse-mcp Python package (Viben CLI).
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
PACKAGE_NAME="browse-mcp"
BRAND_NAME="Viben"
MIN_PYTHON_VERSION="3.10"
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

# Compare version strings (returns 0 if $1 >= $2)
version_ge() {
    printf '%s\n%s\n' "$2" "$1" | sort -V -C
}

# Get Python version as comparable string
get_python_version() {
    local python_cmd="$1"
    "$python_cmd" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || echo "0.0"
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

# Find suitable Python command
find_python() {
    local python_cmd=""
    local version=""

    # Try python3 first, then python
    for cmd in python3 python; do
        if command_exists "$cmd"; then
            version=$(get_python_version "$cmd")
            if version_ge "$version" "$MIN_PYTHON_VERSION"; then
                python_cmd="$cmd"
                break
            fi
        fi
    done

    echo "$python_cmd"
}

# Show help message
show_help() {
    echo "Usage: install.sh [OPTIONS]"
    echo ""
    echo "${BRAND_NAME} CLI Installer - Installs the browse-mcp Python package."
    echo ""
    echo "Options:"
    echo "  -h, --help      Show this help message"
    echo "  --no-confirm    Skip confirmation prompts"
    echo "  --with-uv       Install uv first if not available"
    echo ""
    echo "Requirements:"
    echo "  - Python ${MIN_PYTHON_VERSION} or higher"
    echo "  - pip or uv package manager"
    echo ""
    echo "Examples:"
    echo "  # Default installation"
    echo "  curl -fsSL https://github.com/${GITHUB_REPO}/releases/latest/download/install.sh | bash"
    echo ""
    echo "  # Install with uv (faster)"
    echo "  curl -fsSL https://github.com/${GITHUB_REPO}/releases/latest/download/install.sh | bash -s -- --with-uv"
    echo ""
    echo "More information: https://github.com/${GITHUB_REPO}"
}

# Install uv package manager
install_uv() {
    info "Installing uv package manager..."
    if curl -LsSf https://astral.sh/uv/install.sh | sh; then
        success "uv installed successfully"
        # Source the environment to make uv available
        export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
        return 0
    else
        warn "Failed to install uv, will fall back to pip"
        return 1
    fi
}

# Install the package using uv
install_with_uv() {
    info "Installing ${PACKAGE_NAME} using uv..."
    if uv pip install --system "$PACKAGE_NAME"; then
        return 0
    elif uv pip install "$PACKAGE_NAME"; then
        return 0
    else
        return 1
    fi
}

# Install the package using pip
install_with_pip() {
    local python_cmd="$1"
    info "Installing ${PACKAGE_NAME} using pip..."

    # Try pip3 first, then pip, then python -m pip
    if command_exists pip3; then
        pip3 install "$PACKAGE_NAME" && return 0
    fi

    if command_exists pip; then
        pip install "$PACKAGE_NAME" && return 0
    fi

    if [ -n "$python_cmd" ]; then
        "$python_cmd" -m pip install "$PACKAGE_NAME" && return 0
    fi

    return 1
}

# Verify installation
verify_installation() {
    info "Verifying installation..."

    # Check if browse-mcp command is available
    if command_exists browse-mcp; then
        success "browse-mcp command is available"
        return 0
    fi

    # Check in common locations
    for path in "$HOME/.local/bin/browse-mcp" "/usr/local/bin/browse-mcp"; do
        if [ -x "$path" ]; then
            success "browse-mcp installed at $path"
            warn "You may need to add this directory to your PATH"
            return 0
        fi
    done

    # Try importing the module
    local python_cmd
    python_cmd=$(find_python)
    if [ -n "$python_cmd" ]; then
        if "$python_cmd" -c "import browse_mcp" 2>/dev/null; then
            success "browse_mcp module is installed"
            warn "You can run it with: $python_cmd -m browse_mcp"
            return 0
        fi
    fi

    return 1
}

# Print post-installation instructions
print_instructions() {
    echo ""
    echo -e "${GREEN}${BOLD}Installation complete!${NC}"
    echo ""
    echo "Quick start:"
    echo ""
    echo "  # Run the MCP server"
    echo "  browse-mcp"
    echo ""
    echo "  # Or run as Python module"
    echo "  python -m browse_mcp"
    echo ""
    echo "Configure your MCP client (Claude Desktop, Cursor, etc.):"
    echo ""
    echo "  Add to your MCP configuration:"
    echo ""
    echo '  {
    "mcpServers": {
      "browse-mcp": {
        "command": "browse-mcp"
      }
    }
  }'
    echo ""
    echo "Documentation: https://github.com/${GITHUB_REPO}"
    echo ""
}

# -----------------------------------------------------------------------------
# Main installation logic
# -----------------------------------------------------------------------------

main() {
    local no_confirm=false
    local with_uv=false

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
            --with-uv)
                with_uv=true
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

    # Find Python
    local python_cmd
    python_cmd=$(find_python)

    if [ -z "$python_cmd" ]; then
        error "Python ${MIN_PYTHON_VERSION}+ is required but not found."
        echo ""
        echo "Please install Python ${MIN_PYTHON_VERSION} or higher:"
        echo ""
        case "$os" in
            macos)
                echo "  brew install python@3.12"
                echo "  # or download from https://www.python.org/downloads/"
                ;;
            linux)
                echo "  # Ubuntu/Debian:"
                echo "  sudo apt update && sudo apt install python3 python3-pip"
                echo ""
                echo "  # Fedora:"
                echo "  sudo dnf install python3 python3-pip"
                echo ""
                echo "  # Arch:"
                echo "  sudo pacman -S python python-pip"
                ;;
            *)
                echo "  Download from https://www.python.org/downloads/"
                ;;
        esac
        exit 1
    fi

    local python_version
    python_version=$(get_python_version "$python_cmd")
    success "Found Python $python_version ($python_cmd)"

    # Determine installation method
    local install_method=""

    if command_exists uv; then
        install_method="uv"
        success "Found uv package manager"
    elif [ "$with_uv" = true ]; then
        info "Will install uv package manager first"
        install_method="install_uv"
    elif command_exists pip3 || command_exists pip; then
        install_method="pip"
        success "Found pip package manager"
    else
        error "No package manager found (uv or pip required)"
        echo ""
        echo "Install uv (recommended):"
        echo "  curl -LsSf https://astral.sh/uv/install.sh | sh"
        echo ""
        echo "Or install pip:"
        case "$os" in
            macos)
                echo "  python3 -m ensurepip --upgrade"
                ;;
            linux)
                echo "  sudo apt install python3-pip  # Debian/Ubuntu"
                ;;
        esac
        exit 1
    fi

    # Confirm installation
    if [ "$no_confirm" = false ]; then
        echo ""
        echo "This will install:"
        echo "  - ${PACKAGE_NAME} (${BRAND_NAME} CLI)"
        if [ "$install_method" = "install_uv" ]; then
            echo "  - uv (package manager)"
        fi
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

    # Install uv if requested
    if [ "$install_method" = "install_uv" ]; then
        if install_uv; then
            install_method="uv"
        else
            install_method="pip"
        fi
    fi

    # Install the package
    local install_success=false

    if [ "$install_method" = "uv" ]; then
        if install_with_uv; then
            install_success=true
        else
            warn "uv installation failed, trying pip..."
            if install_with_pip "$python_cmd"; then
                install_success=true
            fi
        fi
    else
        if install_with_pip "$python_cmd"; then
            install_success=true
        fi
    fi

    if [ "$install_success" = false ]; then
        error "Installation failed"
        echo ""
        echo "Try manual installation:"
        echo "  pip install ${PACKAGE_NAME}"
        echo ""
        echo "Or with uv:"
        echo "  uv pip install ${PACKAGE_NAME}"
        exit 1
    fi

    success "Package installed successfully"

    # Verify installation
    echo ""
    if verify_installation; then
        print_instructions
    else
        warn "Installation completed but verification failed"
        echo ""
        echo "The package was installed but the command may not be in your PATH."
        echo "Try running:"
        echo "  $python_cmd -m browse_mcp"
        echo ""
        echo "Or add ~/.local/bin to your PATH:"
        echo '  export PATH="$HOME/.local/bin:$PATH"'
    fi
}

# Run main function
main "$@"
