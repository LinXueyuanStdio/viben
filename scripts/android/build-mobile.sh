#!/bin/bash
# Build Android APK for mobile release
# This script is called from GitHub Actions workflow
#
# Prerequisites:
#   - Java 17
#   - Android SDK with NDK 27.0.12077973
#   - Rust with android targets
#   - Node.js with pnpm
#
# Environment variables:
#   - ANDROID_HOME: Android SDK path
#   - NDK_HOME: Android NDK path
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
echo -e "${BLUE}  Building Android APK${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v java &> /dev/null; then
  echo -e "${RED}Error: Java is not installed${NC}"
  exit 1
fi
echo "  Java: $(java -version 2>&1 | head -1)"

if [[ -z "$ANDROID_HOME" ]]; then
  echo -e "${RED}Error: ANDROID_HOME is not set${NC}"
  exit 1
fi
echo "  ANDROID_HOME: $ANDROID_HOME"

if [[ -z "$NDK_HOME" ]]; then
  echo -e "${YELLOW}Warning: NDK_HOME is not set, will try to find it${NC}"
  NDK_HOME="$ANDROID_HOME/ndk/27.0.12077973"
fi
echo "  NDK_HOME: $NDK_HOME"

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

# Initialize Android project
echo -e "${YELLOW}Initializing Android project...${NC}"
cd apps/desktop
pnpm tauri android init --ci
echo ""

# Build Android APK
echo -e "${YELLOW}Building Android APK...${NC}"
pnpm tauri android build --apk true --ci
echo ""

# Collect artifacts
echo -e "${YELLOW}Collecting artifacts...${NC}"
cd "$PROJECT_ROOT"
mkdir -p android-artifacts
find apps/desktop/src-tauri/gen/android -name "*.apk" -exec cp {} android-artifacts/ \;
find apps/desktop/src-tauri/gen/android -name "*.aab" -exec cp {} android-artifacts/ \; 2>/dev/null || true

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Android build completed!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Artifacts:"
ls -la android-artifacts/
