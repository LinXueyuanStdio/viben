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
#   - ANDROID_KEYSTORE_BASE64: Base64-encoded release keystore (optional)
#   - ANDROID_KEY_ALIAS: Release key alias (required when signing)
#   - ANDROID_KEY_PASSWORD: Release key and store password (required when signing)
#   - RUNNER_TEMP: Temporary directory for GitHub Actions keystore material (optional)

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

# Generate mobile icons before initializing the native project so Tauri copies
# the current Android/iOS icon assets into the generated project.
echo -e "${YELLOW}Generating mobile app icons...${NC}"
cd apps/desktop
pnpm tauri-mobile-icons
cd "$PROJECT_ROOT"
echo ""

# Initialize Android project
echo -e "${YELLOW}Initializing Android project...${NC}"
cd apps/desktop
pnpm tauri android init --ci
echo ""

# Configure Android safe area handling
echo -e "${YELLOW}Configuring Android safe area handling...${NC}"
cd "$PROJECT_ROOT"
./scripts/android/configure-safe-area.sh apps/desktop/src-tauri/gen/android
echo ""

# Configure Android release signing when CI secrets are available.
if [[ -n "$ANDROID_KEYSTORE_BASE64" || -n "$ANDROID_KEY_ALIAS" || -n "$ANDROID_KEY_PASSWORD" ]]; then
  echo -e "${YELLOW}Configuring Android release signing...${NC}"

  if [[ -z "$ANDROID_KEYSTORE_BASE64" || -z "$ANDROID_KEY_ALIAS" || -z "$ANDROID_KEY_PASSWORD" ]]; then
    echo -e "${RED}Error: ANDROID_KEYSTORE_BASE64, ANDROID_KEY_ALIAS, and ANDROID_KEY_PASSWORD must all be set for signing${NC}"
    exit 1
  fi

  ANDROID_PROJECT_DIR="$PROJECT_ROOT/apps/desktop/src-tauri/gen/android"
  KEYSTORE_FILE="${RUNNER_TEMP:-/tmp}/viben-release.keystore"

  cd "$ANDROID_PROJECT_DIR"
  echo "keyAlias=$ANDROID_KEY_ALIAS" > keystore.properties
  echo "password=$ANDROID_KEY_PASSWORD" >> keystore.properties
  base64 -d <<< "$ANDROID_KEYSTORE_BASE64" > "$KEYSTORE_FILE"
  echo "storeFile=$KEYSTORE_FILE" >> keystore.properties

  if ! grep -q "import java.util.Properties" app/build.gradle.kts; then
    sed -i '1s/^/import java.util.Properties\n/' app/build.gradle.kts
  fi
  if ! grep -q "import java.io.FileInputStream" app/build.gradle.kts; then
    sed -i '1s/^/import java.io.FileInputStream\n/' app/build.gradle.kts
  fi

  if ! grep -q "Release signing configuration" app/build.gradle.kts; then
    cat >> app/build.gradle.kts << 'GRADLE_PATCH'

// Release signing configuration
android.signingConfigs {
    create("release") {
        val keystorePropertiesFile = rootProject.file("keystore.properties")
        val keystoreProperties = Properties()
        if (keystorePropertiesFile.exists()) {
            keystoreProperties.load(FileInputStream(keystorePropertiesFile))
        }
        keyAlias = keystoreProperties["keyAlias"] as String?
        keyPassword = keystoreProperties["password"] as String?
        storeFile = keystoreProperties["storeFile"]?.let { file(it as String) }
        storePassword = keystoreProperties["password"] as String?
    }
}

android.buildTypes.getByName("release") {
    signingConfig = android.signingConfigs.getByName("release")
}
GRADLE_PATCH
  fi

  echo "Android signing configured"
  echo "=== keystore.properties ==="
  sed 's/password=.*/password=***/' keystore.properties
  echo "=== build.gradle.kts head ==="
  head -10 app/build.gradle.kts
  echo "=== build.gradle.kts tail ==="
  tail -20 app/build.gradle.kts
  echo ""
else
  echo -e "${YELLOW}Android signing secrets not provided; building unsigned APK${NC}"
  echo ""
fi

# Build Android APK
echo -e "${YELLOW}Building Android APK...${NC}"
cd "$PROJECT_ROOT/apps/desktop"
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
