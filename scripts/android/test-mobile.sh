#!/bin/bash
# Test Android build artifacts
#
# Usage: ./scripts/android/test-mobile.sh [options]
#
# This script verifies the Android APK was built correctly by checking:
#   - APK file exists
#   - APK file size is reasonable
#   - Package info (using aapt if available)
#
# Exit codes:
#   0 - All tests passed
#   1 - One or more tests failed

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default values
VERBOSE=false
MIN_APK_SIZE_MB=10  # Minimum expected APK size in MB

usage() {
  echo -e "${BLUE}Test Android Build Artifacts${NC}"
  echo ""
  echo "Usage: ./scripts/android/test-mobile.sh [options]"
  echo ""
  echo "Options:"
  echo "  -h, --help            Show this help message"
  echo "  -v, --verbose         Enable verbose output"
  echo "  --min-size <MB>       Minimum expected APK size (default: 10 MB)"
  echo "  --apk <path>          Path to specific APK file to test"
  echo ""
  echo "Examples:"
  echo "  ./scripts/android/test-mobile.sh"
  echo "  ./scripts/android/test-mobile.sh --verbose"
  echo "  ./scripts/android/test-mobile.sh --apk ./my-app.apk"
}

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[PASS]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[FAIL]${NC} $1"
}

# Parse arguments
APK_PATH=""
while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      usage
      exit 0
      ;;
    -v|--verbose)
      VERBOSE=true
      shift
      ;;
    --min-size)
      MIN_APK_SIZE_MB="$2"
      shift 2
      ;;
    --apk)
      APK_PATH="$2"
      shift 2
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

# Track test results
TESTS_PASSED=0
TESTS_FAILED=0

run_test() {
  local name="$1"
  local result="$2"

  if [[ "$result" == "pass" ]]; then
    log_success "$name"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    log_error "$name"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
}

# Find APK files
find_apks() {
  if [[ -n "$APK_PATH" ]]; then
    if [[ -f "$APK_PATH" ]]; then
      echo "$APK_PATH"
    else
      log_error "Specified APK not found: $APK_PATH"
      exit 1
    fi
  else
    APK_DIR="$PROJECT_ROOT/apps/desktop/src-tauri/gen/android"
    if [[ -d "$APK_DIR" ]]; then
      find "$APK_DIR" -name "*.apk" -type f 2>/dev/null
    fi
  fi
}

# Test: APK exists
test_apk_exists() {
  log_info "Checking for APK files..."

  APK_FILES=$(find_apks)

  if [[ -z "$APK_FILES" ]]; then
    run_test "APK file exists" "fail"
    log_info "Expected APK location: $PROJECT_ROOT/apps/desktop/src-tauri/gen/android/"
    return 1
  fi

  APK_COUNT=$(echo "$APK_FILES" | wc -l)
  run_test "APK file exists ($APK_COUNT found)" "pass"

  if [[ "$VERBOSE" == "true" ]]; then
    echo "  Found APK files:"
    echo "$APK_FILES" | while read -r apk; do
      echo "    - $apk"
    done
  fi

  return 0
}

# Test: APK file size
test_apk_size() {
  log_info "Checking APK file sizes..."

  APK_FILES=$(find_apks)
  local all_passed=true

  echo "$APK_FILES" | while read -r apk; do
    if [[ -z "$apk" ]]; then
      continue
    fi

    SIZE_BYTES=$(stat -c%s "$apk" 2>/dev/null || stat -f%z "$apk" 2>/dev/null)
    SIZE_MB=$((SIZE_BYTES / 1024 / 1024))

    APK_NAME=$(basename "$apk")

    if [[ $SIZE_MB -ge $MIN_APK_SIZE_MB ]]; then
      run_test "APK size check: $APK_NAME (${SIZE_MB}MB >= ${MIN_APK_SIZE_MB}MB)" "pass"
    else
      run_test "APK size check: $APK_NAME (${SIZE_MB}MB < ${MIN_APK_SIZE_MB}MB)" "fail"
      all_passed=false
    fi
  done

  if [[ "$all_passed" == "false" ]]; then
    return 1
  fi
  return 0
}

# Test: APK package info (using aapt)
test_apk_package_info() {
  log_info "Checking APK package info..."

  # Check if aapt is available
  if ! command -v aapt &> /dev/null; then
    # Try to find aapt in Android SDK
    if [[ -n "$ANDROID_HOME" ]]; then
      AAPT_PATH=$(find "$ANDROID_HOME/build-tools" -name "aapt" -type f 2>/dev/null | head -1)
      if [[ -n "$AAPT_PATH" ]]; then
        AAPT_CMD="$AAPT_PATH"
      fi
    fi

    if [[ -z "$AAPT_CMD" ]]; then
      log_warn "aapt not found - skipping package info verification"
      log_info "Install Android build-tools to enable this check"
      return 0
    fi
  else
    AAPT_CMD="aapt"
  fi

  APK_FILES=$(find_apks)
  local first_apk=$(echo "$APK_FILES" | head -1)

  if [[ -z "$first_apk" ]]; then
    return 0
  fi

  log_info "Dumping package info for: $(basename "$first_apk")"

  PACKAGE_INFO=$("$AAPT_CMD" dump badging "$first_apk" 2>/dev/null || true)

  if [[ -z "$PACKAGE_INFO" ]]; then
    run_test "APK package info readable" "fail"
    return 1
  fi

  run_test "APK package info readable" "pass"

  # Extract and display package info
  PACKAGE_NAME=$(echo "$PACKAGE_INFO" | grep "package: name=" | sed "s/.*name='\([^']*\)'.*/\1/")
  VERSION_NAME=$(echo "$PACKAGE_INFO" | grep "package: name=" | sed "s/.*versionName='\([^']*\)'.*/\1/")
  VERSION_CODE=$(echo "$PACKAGE_INFO" | grep "package: name=" | sed "s/.*versionCode='\([^']*\)'.*/\1/")
  MIN_SDK=$(echo "$PACKAGE_INFO" | grep "sdkVersion:" | sed "s/sdkVersion:'\([^']*\)'/\1/")
  TARGET_SDK=$(echo "$PACKAGE_INFO" | grep "targetSdkVersion:" | sed "s/targetSdkVersion:'\([^']*\)'/\1/")

  echo ""
  echo -e "${CYAN}Package Information:${NC}"
  echo "  Package:     $PACKAGE_NAME"
  echo "  Version:     $VERSION_NAME (code: $VERSION_CODE)"
  echo "  Min SDK:     $MIN_SDK"
  echo "  Target SDK:  $TARGET_SDK"

  # Validate package name
  if [[ "$PACKAGE_NAME" == *"viben"* ]]; then
    run_test "Package name contains 'viben'" "pass"
  else
    run_test "Package name contains 'viben' (got: $PACKAGE_NAME)" "fail"
  fi

  return 0
}

# Test: APK is valid ZIP (basic integrity check)
test_apk_integrity() {
  log_info "Checking APK integrity..."

  APK_FILES=$(find_apks)
  local first_apk=$(echo "$APK_FILES" | head -1)

  if [[ -z "$first_apk" ]]; then
    return 0
  fi

  # APK is a ZIP file, try to list contents
  if unzip -t "$first_apk" > /dev/null 2>&1; then
    run_test "APK integrity check (valid ZIP)" "pass"

    if [[ "$VERBOSE" == "true" ]]; then
      echo "  APK contains:"
      unzip -l "$first_apk" 2>/dev/null | grep -E "(classes\.dex|AndroidManifest\.xml|lib/)" | head -10
    fi
  else
    run_test "APK integrity check (valid ZIP)" "fail"
    return 1
  fi

  return 0
}

# Main execution
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Viben Android Build Tests${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Run tests
test_apk_exists || true
echo ""
test_apk_size || true
echo ""
test_apk_integrity || true
echo ""
test_apk_package_info || true

# Summary
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Test Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "  Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [[ $TESTS_FAILED -gt 0 ]]; then
  echo -e "${RED}Some tests failed!${NC}"
  exit 1
else
  echo -e "${GREEN}All tests passed!${NC}"
  exit 0
fi
