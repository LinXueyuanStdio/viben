#!/bin/bash
# Build iOS app for Viben mobile
#
# Usage: ./scripts/ios/build-mobile.sh [options]
#
# This script builds the iOS app using Tauri. It requires macOS with Xcode
# installed.
#
# Prerequisites:
#   - macOS with Xcode installed
#   - Node.js and pnpm installed
#   - Rust with iOS targets installed
#   - Apple Developer account (for signed builds)
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
EXPORT_METHOD="debugging"  # debugging, app-store-connect, ad-hoc, enterprise
VERBOSE=false
INIT_ONLY=false
DEVELOPMENT_TEAM=""

usage() {
  echo -e "${BLUE}Build iOS App for Viben${NC}"
  echo ""
  echo "Usage: ./scripts/ios/build-mobile.sh [options]"
  echo ""
  echo "Options:"
  echo "  -h, --help                Show this help message"
  echo "  --skip-deps               Skip building workspace dependencies"
  echo "  --export-method <method>  Export method (default: debugging)"
  echo "                            Values: debugging, app-store-connect, ad-hoc, enterprise"
  echo "  --team <team-id>          Apple Development Team ID"
  echo "  --init-only               Only initialize iOS project, don't build"
  echo "  -v, --verbose             Enable verbose output"
  echo ""
  echo "Environment variables:"
  echo "  APPLE_DEVELOPMENT_TEAM    Apple Development Team ID (alternative to --team)"
  echo ""
  echo "Examples:"
  echo "  ./scripts/ios/build-mobile.sh"
  echo "  ./scripts/ios/build-mobile.sh --export-method ad-hoc --team ABCD1234"
  echo "  ./scripts/ios/build-mobile.sh --skip-deps --verbose"
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
    --export-method)
      EXPORT_METHOD="$2"
      shift 2
      ;;
    --team)
      DEVELOPMENT_TEAM="$2"
      shift 2
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

  # Check if running on macOS
  if [[ "$(uname)" != "Darwin" ]]; then
    log_error "iOS builds require macOS"
    log_info "Current platform: $(uname)"
    exit 1
  fi
  log_info "Platform: macOS"

  # Check Xcode
  if ! command -v xcodebuild &> /dev/null; then
    log_error "Xcode is not installed"
    log_info "Please install Xcode from the App Store"
    exit 1
  fi
  XCODE_VERSION=$(xcodebuild -version | head -1)
  log_info "Xcode: $XCODE_VERSION"

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

  # Check iOS targets
  if ! rustup target list --installed | grep -q "aarch64-apple-ios"; then
    log_warn "iOS Rust targets not installed. Installing..."
    rustup target add aarch64-apple-ios aarch64-apple-ios-sim
  fi
  log_info "iOS Rust targets installed"
}

setup_development_team() {
  # Use environment variable if team not specified via flag
  if [[ -z "$DEVELOPMENT_TEAM" ]]; then
    DEVELOPMENT_TEAM="${APPLE_DEVELOPMENT_TEAM:-}"
  fi

  if [[ -n "$DEVELOPMENT_TEAM" ]]; then
    log_info "Setting development team: $DEVELOPMENT_TEAM"

    cd "$PROJECT_ROOT/apps/desktop/src-tauri"

    # Update tauri.conf.json with development team
    if command -v jq &> /dev/null; then
      jq --arg t "$DEVELOPMENT_TEAM" '.bundle.iOS.developmentTeam = $t' tauri.conf.json > tauri.conf.tmp.json
      mv tauri.conf.tmp.json tauri.conf.json
      log_success "Development team configured"
    else
      log_warn "jq not found - cannot automatically set development team"
      log_info "Please manually set bundle.iOS.developmentTeam in tauri.conf.json"
    fi
  else
    log_warn "No development team specified - building unsigned"
    log_info "Use --team <team-id> or set APPLE_DEVELOPMENT_TEAM for signed builds"
  fi
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

init_ios_project() {
  log_info "Initializing iOS project..."
  cd "$PROJECT_ROOT/apps/desktop"
  pnpm tauri ios init
  log_success "iOS project initialized"
}

build_ios() {
  log_info "Building iOS with export method: $EXPORT_METHOD"
  cd "$PROJECT_ROOT/apps/desktop"

  if [[ "$VERBOSE" == "true" ]]; then
    pnpm tauri ios build --export-method "$EXPORT_METHOD"
  else
    pnpm tauri ios build --export-method "$EXPORT_METHOD" 2>&1 | grep -E "(Building|Compiling|Finished|error|warning:|Build succeeded|IPA)" || true
  fi

  log_success "iOS build completed"
}

show_artifacts() {
  log_info "Build artifacts:"
  echo ""

  APPLE_DIR="$PROJECT_ROOT/apps/desktop/src-tauri/gen/apple"

  if [[ -d "$APPLE_DIR" ]]; then
    echo -e "${CYAN}iOS artifacts:${NC}"

    # Look for IPA files
    IPA_FILES=$(find "$APPLE_DIR" -name "*.ipa" -type f 2>/dev/null)
    if [[ -n "$IPA_FILES" ]]; then
      echo "IPA files:"
      echo "$IPA_FILES" | while read -r ipa; do
        ls -lh "$ipa"
      done
    fi

    # Look for .app bundles
    APP_BUNDLES=$(find "$APPLE_DIR" -name "*.app" -type d 2>/dev/null)
    if [[ -n "$APP_BUNDLES" ]]; then
      echo ""
      echo ".app bundles:"
      echo "$APP_BUNDLES" | while read -r app; do
        du -sh "$app"
      done
    fi

    if [[ -z "$IPA_FILES" && -z "$APP_BUNDLES" ]]; then
      log_warn "No IPA or .app files found"
      log_info "Build output directory: $APPLE_DIR"
      log_info "Contents:"
      ls -la "$APPLE_DIR" 2>/dev/null || true
    fi
  else
    log_warn "Apple build directory not found: $APPLE_DIR"
  fi
}

# Main execution
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Viben iOS Build${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

check_prerequisites
setup_development_team
build_dependencies
init_ios_project

if [[ "$INIT_ONLY" == "true" ]]; then
  log_success "iOS project initialized (--init-only)"
  exit 0
fi

build_ios
show_artifacts

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✓ iOS build completed successfully!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
