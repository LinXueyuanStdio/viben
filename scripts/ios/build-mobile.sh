#!/bin/bash
# Build iOS app for mobile release
# This script is called from GitHub Actions workflow
#
# Prerequisites:
#   - macOS with Xcode
#   - Cocoapods
#   - Rust with iOS targets
#   - Node.js with pnpm
#
# Environment variables:
#   - VERSION: Version to build (optional)

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Building iOS App${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if [[ "$(uname)" != "Darwin" ]]; then
  echo -e "${RED}Error: iOS build requires macOS${NC}"
  exit 1
fi
echo "  OS: macOS $(sw_vers -productVersion)"

if ! command -v xcodebuild &> /dev/null; then
  echo -e "${RED}Error: Xcode is not installed${NC}"
  exit 1
fi
echo "  Xcode: $(xcodebuild -version | head -1)"

if ! command -v pod &> /dev/null; then
  echo -e "${YELLOW}Warning: Cocoapods not found, installing...${NC}"
  brew install cocoapods || true
fi
echo "  Cocoapods: $(pod --version)"

if ! command -v rustc &> /dev/null; then
  echo -e "${RED}Error: Rust is not installed${NC}"
  exit 1
fi
echo "  Rust: $(rustc --version)"

if ! command -v pnpm &> /dev/null; then
  echo -e "${RED}Error: pnpm is not installed${NC}"
  exit 1
fi
echo "  pnpm: $(pnpm --version)"

echo ""

# Change to project root
cd "$PROJECT_ROOT"

# Sync version if provided
if [[ -n "$VERSION" ]]; then
  echo -e "${YELLOW}Syncing version to $VERSION...${NC}"
  ./scripts/sync-version.sh "$VERSION"
  echo ""
fi

# Build workspace packages
echo -e "${YELLOW}Building workspace packages...${NC}"
pnpm turbo build --filter=@viben/desktop^...
echo ""

# Initialize iOS project
echo -e "${YELLOW}Initializing iOS project...${NC}"
cd apps/desktop
pnpm tauri ios init --ci
echo ""

# Build iOS (simulator)
echo -e "${YELLOW}Building iOS for simulator...${NC}"
pnpm tauri ios build --target aarch64-sim --ci
echo ""

# Collect artifacts
echo -e "${YELLOW}Collecting artifacts...${NC}"
cd "$PROJECT_ROOT"
mkdir -p ios-artifacts

# Find and package .app bundle
APP_PATH=$(find apps/desktop/src-tauri/gen/apple -name "*.app" -type d | head -1)
if [[ -n "$APP_PATH" ]]; then
  APP_NAME=$(basename "$APP_PATH")
  cd "$(dirname "$APP_PATH")"
  zip -r "$PROJECT_ROOT/ios-artifacts/${APP_NAME%.app}-simulator.zip" "$APP_NAME"
fi

# Copy any IPA files
find "$PROJECT_ROOT/apps/desktop/src-tauri/gen/apple" -name "*.ipa" -exec cp {} "$PROJECT_ROOT/ios-artifacts/" \; 2>/dev/null || true

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  iOS build completed!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Artifacts:"
ls -la "$PROJECT_ROOT/ios-artifacts/"
