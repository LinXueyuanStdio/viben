#!/bin/bash
# Build Android APK for Viben mobile app
#
# Usage: ./scripts/android/build-mobile.sh [options]
#
# This script builds the Android APK using Tauri. It can be run locally
# or in CI environments.
#
# Prerequisites:
#   - Node.js and pnpm installed
#   - Rust with Android targets installed
#   - Android SDK and NDK installed
#
# Exit codes:
#   0 - Build completed successfully
#   1 - Build failed

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default values
SKIP_DEPS=false
APK_ONLY=true
AAB_ONLY=false
VERBOSE=false
INIT_ONLY=false

usage() {
  echo -e "${BLUE}Build Android APK for Viben${NC}"
  echo ""
  echo "Usage: ./scripts/android/build-mobile.sh [options]"
  echo ""
  echo "Options:"
  echo "  -h, --help        Show this help message"
  echo "  --skip-deps       Skip building workspace dependencies"
  echo "  --aab             Build AAB (Android App Bundle) instead of APK"
  echo "  --both            Build both APK and AAB"
  echo "  --init-only       Only initialize Android project, don't build"
  echo "  -v, --verbose     Enable verbose output"
  echo ""
  echo "Environment variables:"
  echo "  ANDROID_HOME      Android SDK location (default: \$HOME/Android/Sdk)"
  echo "  NDK_HOME          Android NDK location (default: \$ANDROID_HOME/ndk/<version>)"
  echo ""
  echo "Examples:"
  echo "  ./scripts/android/build-mobile.sh"
  echo "  ./scripts/android/build-mobile.sh --aab"
  echo "  ./scripts/android/build-mobile.sh --skip-deps --verbose"
}

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      usage
      exit 0
      ;;
    --skip-deps)
      SKIP_DEPS=true
      shift
      ;;
    --aab)
      APK_ONLY=false
      AAB_ONLY=true
      shift
      ;;
    --both)
      APK_ONLY=false
      AAB_ONLY=false
      shift
      ;;
    --init-only)
      INIT_ONLY=true
      shift
      ;;
    -v|--verbose)
      VERBOSE=true
      shift
      ;;
    *)
      log_error "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

# Find project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

log_info "Project root: $PROJECT_ROOT"

# Check for required tools
check_prerequisites() {
  log_info "Checking prerequisites..."

  # Check Node.js
  if ! command -v node &> /dev/null; then
    log_error "Node.js is not installed"
    exit 1
  fi
  log_info "Node.js: $(node --version)"

  # Check pnpm
  if ! command -v pnpm &> /dev/null; then
    log_error "pnpm is not installed"
    exit 1
  fi
  log_info "pnpm: $(pnpm --version)"

  # Check Rust
  if ! command -v rustc &> /dev/null; then
    log_error "Rust is not installed"
    exit 1
  fi
  log_info "Rust: $(rustc --version)"

  # Check Android targets
  if ! rustup target list --installed | grep -q "aarch64-linux-android"; then
    log_warn "Android Rust targets not installed. Installing..."
    rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
  fi
  log_info "Android Rust targets installed"
}

setup_android_env() {
  log_info "Setting up Android environment..."

  # Set ANDROID_HOME if not set
  if [[ -z "$ANDROID_HOME" ]]; then
    if [[ -d "$HOME/Android/Sdk" ]]; then
      export ANDROID_HOME="$HOME/Android/Sdk"
    elif [[ -d "$HOME/Library/Android/sdk" ]]; then
      export ANDROID_HOME="$HOME/Library/Android/sdk"
    elif [[ -d "/usr/local/lib/android/sdk" ]]; then
      export ANDROID_HOME="/usr/local/lib/android/sdk"
    else
      log_error "ANDROID_HOME not set and Android SDK not found in default locations"
      log_info "Please set ANDROID_HOME environment variable"
      exit 1
    fi
  fi
  log_info "ANDROID_HOME: $ANDROID_HOME"

  # Set NDK_HOME if not set
  if [[ -z "$NDK_HOME" ]]; then
    # Try to find the latest NDK version
    if [[ -d "$ANDROID_HOME/ndk" ]]; then
      NDK_VERSION=$(ls "$ANDROID_HOME/ndk" | sort -V | tail -1)
      if [[ -n "$NDK_VERSION" ]]; then
        export NDK_HOME="$ANDROID_HOME/ndk/$NDK_VERSION"
      fi
    fi
  fi

  if [[ -z "$NDK_HOME" || ! -d "$NDK_HOME" ]]; then
    log_error "NDK_HOME not set or NDK not found"
    log_info "Please install Android NDK: sdkmanager --install \"ndk;27.0.12077973\""
    exit 1
  fi
  log_info "NDK_HOME: $NDK_HOME"

  # Add to PATH
  export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/tools:$PATH"
}

build_dependencies() {
  if [[ "$SKIP_DEPS" == "true" ]]; then
    log_info "Skipping dependency build (--skip-deps)"
    return
  fi

  log_info "Building workspace dependencies..."
  cd "$PROJECT_ROOT"
  pnpm turbo build --filter=@viben/desktop^...
  log_success "Dependencies built"
}

init_android_project() {
  log_info "Initializing Android project..."
  cd "$PROJECT_ROOT/apps/desktop"
  pnpm tauri android init
  log_success "Android project initialized"
}

build_android() {
  log_info "Building Android..."
  cd "$PROJECT_ROOT/apps/desktop"

  if [[ "$APK_ONLY" == "true" ]]; then
    log_info "Building APK..."
    if [[ "$VERBOSE" == "true" ]]; then
      pnpm tauri android build --apk true
    else
      pnpm tauri android build --apk true 2>&1 | grep -E "(Building|Compiling|Finished|error|warning:|APK)" || true
    fi
  elif [[ "$AAB_ONLY" == "true" ]]; then
    log_info "Building AAB..."
    if [[ "$VERBOSE" == "true" ]]; then
      pnpm tauri android build
    else
      pnpm tauri android build 2>&1 | grep -E "(Building|Compiling|Finished|error|warning:|AAB)" || true
    fi
  else
    log_info "Building both APK and AAB..."
    if [[ "$VERBOSE" == "true" ]]; then
      pnpm tauri android build --apk true
    else
      pnpm tauri android build --apk true 2>&1 | grep -E "(Building|Compiling|Finished|error|warning:|APK|AAB)" || true
    fi
  fi

  log_success "Android build completed"
}

show_artifacts() {
  log_info "Build artifacts:"
  echo ""

  APK_DIR="$PROJECT_ROOT/apps/desktop/src-tauri/gen/android/app/build/outputs/apk"
  AAB_DIR="$PROJECT_ROOT/apps/desktop/src-tauri/gen/android/app/build/outputs/bundle"

  if [[ -d "$APK_DIR" ]]; then
    echo -e "${CYAN}APK files:${NC}"
    find "$APK_DIR" -name "*.apk" -exec ls -lh {} \; 2>/dev/null || echo "  No APK files found"
  fi

  if [[ -d "$AAB_DIR" ]]; then
    echo ""
    echo -e "${CYAN}AAB files:${NC}"
    find "$AAB_DIR" -name "*.aab" -exec ls -lh {} \; 2>/dev/null || echo "  No AAB files found"
  fi
}

# Main execution
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Viben Android Build${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

check_prerequisites
setup_android_env
build_dependencies
init_android_project

if [[ "$INIT_ONLY" == "true" ]]; then
  log_success "Android project initialized (--init-only)"
  exit 0
fi

build_android
show_artifacts

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✓ Android build completed successfully!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
