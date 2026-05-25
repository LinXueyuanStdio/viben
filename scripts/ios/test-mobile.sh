#!/bin/bash
# Test iOS build artifacts
#
# Usage: ./scripts/ios/test-mobile.sh [options]
#
# This script verifies the iOS build was created correctly by checking:
#   - IPA or .app file exists
#   - File size is reasonable
#   - Bundle info (if plutil available)
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
MIN_APP_SIZE_MB=10  # Minimum expected app size in MB

usage() {
  echo -e "${BLUE}Test iOS Build Artifacts${NC}"
  echo ""
  echo "Usage: ./scripts/ios/test-mobile.sh [options]"
  echo ""
  echo "Options:"
  echo "  -h, --help            Show this help message"
  echo "  -v, --verbose         Enable verbose output"
  echo "  --min-size <MB>       Minimum expected app size (default: 10 MB)"
  echo "  --app <path>          Path to specific .app or .ipa file to test"
  echo ""
  echo "Examples:"
  echo "  ./scripts/ios/test-mobile.sh"
  echo "  ./scripts/ios/test-mobile.sh --verbose"
  echo "  ./scripts/ios/test-mobile.sh --app ./MyApp.app"
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
APP_PATH=""
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
      MIN_APP_SIZE_MB="$2"
      shift 2
      ;;
    --app)
      APP_PATH="$2"
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

# Find iOS artifacts
find_ios_artifacts() {
  if [[ -n "$APP_PATH" ]]; then
    if [[ -e "$APP_PATH" ]]; then
      echo "$APP_PATH"
    else
      log_error "Specified app not found: $APP_PATH"
      exit 1
    fi
  else
    APPLE_DIR="$PROJECT_ROOT/apps/desktop/src-tauri/gen/apple"
    if [[ -d "$APPLE_DIR" ]]; then
      # Find IPA files first, then .app bundles
      find "$APPLE_DIR" -name "*.ipa" -type f 2>/dev/null
      find "$APPLE_DIR" -name "*.app" -type d 2>/dev/null
    fi
  fi
}

# Test: iOS artifact exists
test_artifact_exists() {
  log_info "Checking for iOS artifacts..."

  ARTIFACTS=$(find_ios_artifacts)

  if [[ -z "$ARTIFACTS" ]]; then
    run_test "iOS artifact exists" "fail"
    log_info "Expected artifact location: $PROJECT_ROOT/apps/desktop/src-tauri/gen/apple/"
    return 1
  fi

  ARTIFACT_COUNT=$(echo "$ARTIFACTS" | wc -l)
  run_test "iOS artifact exists ($ARTIFACT_COUNT found)" "pass"

  if [[ "$VERBOSE" == "true" ]]; then
    echo "  Found artifacts:"
    echo "$ARTIFACTS" | while read -r artifact; do
      echo "    - $artifact"
    done
  fi

  return 0
}

# Test: Artifact file size
test_artifact_size() {
  log_info "Checking artifact sizes..."

  ARTIFACTS=$(find_ios_artifacts)

  echo "$ARTIFACTS" | while read -r artifact; do
    if [[ -z "$artifact" ]]; then
      continue
    fi

    ARTIFACT_NAME=$(basename "$artifact")

    # Get size (works for both files and directories)
    if [[ -d "$artifact" ]]; then
      # For .app bundles, use du
      SIZE_BYTES=$(du -s "$artifact" | awk '{print $1}')
      SIZE_BYTES=$((SIZE_BYTES * 1024))  # du reports in KB on macOS
    else
      # For IPA files, use stat
      SIZE_BYTES=$(stat -f%z "$artifact" 2>/dev/null || stat -c%s "$artifact" 2>/dev/null)
    fi

    SIZE_MB=$((SIZE_BYTES / 1024 / 1024))

    if [[ $SIZE_MB -ge $MIN_APP_SIZE_MB ]]; then
      run_test "Size check: $ARTIFACT_NAME (${SIZE_MB}MB >= ${MIN_APP_SIZE_MB}MB)" "pass"
    else
      run_test "Size check: $ARTIFACT_NAME (${SIZE_MB}MB < ${MIN_APP_SIZE_MB}MB)" "fail"
    fi
  done

  return 0
}

# Test: IPA is valid ZIP
test_ipa_integrity() {
  log_info "Checking IPA integrity..."

  ARTIFACTS=$(find_ios_artifacts)
  IPA_FILE=$(echo "$ARTIFACTS" | grep -E "\.ipa$" | head -1)

  if [[ -z "$IPA_FILE" ]]; then
    log_info "No IPA file found - skipping IPA integrity check"
    return 0
  fi

  # IPA is a ZIP file, try to list contents
  if unzip -t "$IPA_FILE" > /dev/null 2>&1; then
    run_test "IPA integrity check (valid ZIP)" "pass"

    if [[ "$VERBOSE" == "true" ]]; then
      echo "  IPA contains:"
      unzip -l "$IPA_FILE" 2>/dev/null | grep -E "(Payload/.*\.app/)" | head -10
    fi
  else
    run_test "IPA integrity check (valid ZIP)" "fail"
    return 1
  fi

  return 0
}

# Test: App bundle info
test_bundle_info() {
  log_info "Checking bundle info..."

  ARTIFACTS=$(find_ios_artifacts)

  # Find an .app bundle (either directly or inside IPA)
  APP_BUNDLE=$(echo "$ARTIFACTS" | grep -E "\.app$" | head -1)

  if [[ -z "$APP_BUNDLE" ]]; then
    # Try to extract from IPA
    IPA_FILE=$(echo "$ARTIFACTS" | grep -E "\.ipa$" | head -1)
    if [[ -n "$IPA_FILE" ]]; then
      log_info "Extracting Info.plist from IPA..."
      TEMP_DIR=$(mktemp -d)
      unzip -q "$IPA_FILE" "Payload/*.app/Info.plist" -d "$TEMP_DIR" 2>/dev/null || true
      INFO_PLIST=$(find "$TEMP_DIR" -name "Info.plist" 2>/dev/null | head -1)
    fi
  else
    INFO_PLIST="$APP_BUNDLE/Info.plist"
  fi

  if [[ -z "$INFO_PLIST" || ! -f "$INFO_PLIST" ]]; then
    log_warn "Info.plist not found - skipping bundle info check"
    return 0
  fi

  # Check if plutil is available (macOS only)
  if ! command -v plutil &> /dev/null; then
    log_warn "plutil not available - skipping bundle info parsing"
    run_test "Info.plist exists" "pass"
    return 0
  fi

  run_test "Info.plist exists" "pass"

  # Extract bundle info
  BUNDLE_ID=$(plutil -extract CFBundleIdentifier raw "$INFO_PLIST" 2>/dev/null || echo "unknown")
  BUNDLE_NAME=$(plutil -extract CFBundleName raw "$INFO_PLIST" 2>/dev/null || echo "unknown")
  BUNDLE_VERSION=$(plutil -extract CFBundleShortVersionString raw "$INFO_PLIST" 2>/dev/null || echo "unknown")
  BUILD_NUMBER=$(plutil -extract CFBundleVersion raw "$INFO_PLIST" 2>/dev/null || echo "unknown")
  MIN_IOS=$(plutil -extract MinimumOSVersion raw "$INFO_PLIST" 2>/dev/null || echo "unknown")

  echo ""
  echo -e "${CYAN}Bundle Information:${NC}"
  echo "  Bundle ID:      $BUNDLE_ID"
  echo "  Bundle Name:    $BUNDLE_NAME"
  echo "  Version:        $BUNDLE_VERSION (build: $BUILD_NUMBER)"
  echo "  Min iOS:        $MIN_IOS"

  # Validate bundle ID
  if [[ "$BUNDLE_ID" == *"viben"* ]]; then
    run_test "Bundle ID contains 'viben'" "pass"
  else
    run_test "Bundle ID contains 'viben' (got: $BUNDLE_ID)" "fail"
  fi

  # Clean up temp directory
  if [[ -n "$TEMP_DIR" && -d "$TEMP_DIR" ]]; then
    rm -rf "$TEMP_DIR"
  fi

  return 0
}

# Test: .app bundle structure (for .app files)
test_app_structure() {
  log_info "Checking .app bundle structure..."

  ARTIFACTS=$(find_ios_artifacts)
  APP_BUNDLE=$(echo "$ARTIFACTS" | grep -E "\.app$" | head -1)

  if [[ -z "$APP_BUNDLE" || ! -d "$APP_BUNDLE" ]]; then
    log_info "No .app bundle found directly - skipping structure check"
    return 0
  fi

  # Check for required files in .app bundle
  local required_files=("Info.plist")
  local all_exist=true

  for file in "${required_files[@]}"; do
    if [[ -f "$APP_BUNDLE/$file" ]]; then
      if [[ "$VERBOSE" == "true" ]]; then
        log_info "Found: $file"
      fi
    else
      log_warn "Missing: $file"
      all_exist=false
    fi
  done

  # Check for executable
  APP_NAME=$(basename "$APP_BUNDLE" .app)
  if [[ -f "$APP_BUNDLE/$APP_NAME" ]]; then
    run_test "Executable exists: $APP_NAME" "pass"

    if [[ "$VERBOSE" == "true" ]]; then
      file "$APP_BUNDLE/$APP_NAME"
    fi
  else
    run_test "Executable exists: $APP_NAME" "fail"
    all_exist=false
  fi

  if [[ "$all_exist" == "true" ]]; then
    run_test "App bundle structure valid" "pass"
  else
    run_test "App bundle structure valid" "fail"
  fi

  return 0
}

# Main execution
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Viben iOS Build Tests${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Run tests
test_artifact_exists || true
echo ""
test_artifact_size || true
echo ""
test_ipa_integrity || true
echo ""
test_app_structure || true
echo ""
test_bundle_info || true

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
