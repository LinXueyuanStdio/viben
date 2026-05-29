#!/bin/bash
# Generate GitHub Job Summary for iOS test results
# Usage: ./test-summary.sh [options]
#
# Environment variables (set by workflow):
#   SIMULATOR_NAME  - Name of the iOS simulator
#   APP_VERSION     - App version string
#   BUNDLE_ID       - App bundle identifier
#
# Arguments:
#   --screenshots-pattern  - Glob pattern for screenshots (default: ios-screenshot*.png)
#   --maestro-results      - Path to Maestro JUnit XML results (default: maestro-ios-results.xml)
#   --crash-log            - Path to crash log file (default: ios-crash-log.txt)

set -euo pipefail

# Defaults
SCREENSHOTS_PATTERN="ios-screenshot*.png"
MAESTRO_RESULTS="maestro-ios-results.xml"
CRASH_LOG="ios-crash-log.txt"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --screenshots-pattern)
      SCREENSHOTS_PATTERN="$2"
      shift 2
      ;;
    --maestro-results)
      MAESTRO_RESULTS="$2"
      shift 2
      ;;
    --crash-log)
      CRASH_LOG="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

# Output file (GitHub Actions sets this automatically)
SUMMARY_FILE="${GITHUB_STEP_SUMMARY:-/dev/stdout}"

echo "## 🍎 iOS Test Results" >> "$SUMMARY_FILE"
echo "" >> "$SUMMARY_FILE"

# =============================================================================
# Device Info
# =============================================================================
echo "### 📱 Device Info" >> "$SUMMARY_FILE"
echo "" >> "$SUMMARY_FILE"
echo "| Property | Value |" >> "$SUMMARY_FILE"
echo "|----------|-------|" >> "$SUMMARY_FILE"
echo "| Simulator | ${SIMULATOR_NAME:-N/A} |" >> "$SUMMARY_FILE"
echo "| App Version | ${APP_VERSION:-N/A} |" >> "$SUMMARY_FILE"
echo "| Bundle ID | ${BUNDLE_ID:-N/A} |" >> "$SUMMARY_FILE"
echo "" >> "$SUMMARY_FILE"

# =============================================================================
# Maestro Test Results
# =============================================================================
if [ -f "$MAESTRO_RESULTS" ]; then
  # Use grep -oE for compatibility (works on both Linux and macOS)
  TESTS=$(grep -oE 'tests="[0-9]+"' "$MAESTRO_RESULTS" | head -1 | grep -oE '[0-9]+' || echo "0")
  FAILURES=$(grep -oE 'failures="[0-9]+"' "$MAESTRO_RESULTS" | head -1 | grep -oE '[0-9]+' || echo "0")
  ERRORS=$(grep -oE 'errors="[0-9]+"' "$MAESTRO_RESULTS" | head -1 | grep -oE '[0-9]+' || echo "0")

  if [ "${FAILURES:-0}" = "0" ] && [ "${ERRORS:-0}" = "0" ]; then
    echo "### ✅ Maestro Tests Passed" >> "$SUMMARY_FILE"
  else
    echo "### ❌ Maestro Tests Failed" >> "$SUMMARY_FILE"
  fi
  echo "" >> "$SUMMARY_FILE"
  echo "| Metric | Count |" >> "$SUMMARY_FILE"
  echo "|--------|-------|" >> "$SUMMARY_FILE"
  echo "| Tests | ${TESTS:-0} |" >> "$SUMMARY_FILE"
  echo "| Failures | ${FAILURES:-0} |" >> "$SUMMARY_FILE"
  echo "| Errors | ${ERRORS:-0} |" >> "$SUMMARY_FILE"
  echo "" >> "$SUMMARY_FILE"
else
  echo "### ⚠️ No Maestro Results" >> "$SUMMARY_FILE"
  echo "" >> "$SUMMARY_FILE"
fi

# =============================================================================
# Crash Detection
# =============================================================================
if [ -f "$CRASH_LOG" ]; then
  echo "### 💥 App Crash Detected" >> "$SUMMARY_FILE"
  echo "" >> "$SUMMARY_FILE"
  echo '```' >> "$SUMMARY_FILE"
  head -30 "$CRASH_LOG" >> "$SUMMARY_FILE"
  echo '```' >> "$SUMMARY_FILE"
  echo "" >> "$SUMMARY_FILE"
fi

# =============================================================================
# Screenshots (list with file names - images available in artifacts)
# =============================================================================
echo "### 📸 Screenshots" >> "$SUMMARY_FILE"
echo "" >> "$SUMMARY_FILE"

# Collect screenshots using glob pattern
# shellcheck disable=SC2206
SCREENSHOTS=($SCREENSHOTS_PATTERN)

# Check if glob expanded (file exists)
if [ -e "${SCREENSHOTS[0]:-}" ]; then
  echo "> 📥 Download the **ios-test-results** artifact to view images" >> "$SUMMARY_FILE"
  echo "" >> "$SUMMARY_FILE"
  echo "| # | Screenshot | Size |" >> "$SUMMARY_FILE"
  echo "|---|------------|------|" >> "$SUMMARY_FILE"

  for i in "${!SCREENSHOTS[@]}"; do
    IMG="${SCREENSHOTS[$i]}"
    NAME=$(basename "$IMG")
    # macOS du uses -h differently, use stat for more reliable size
    if [[ "$OSTYPE" == "darwin"* ]]; then
      SIZE=$(stat -f%z "$IMG" 2>/dev/null | awk '{printf "%.1fK", $1/1024}' || echo "N/A")
    else
      SIZE=$(du -h "$IMG" 2>/dev/null | cut -f1 || echo "N/A")
    fi
    echo "| $((i+1)) | \`${NAME}\` | ${SIZE} |" >> "$SUMMARY_FILE"
  done

  echo "" >> "$SUMMARY_FILE"
  echo "_${#SCREENSHOTS[@]} screenshot(s) captured_" >> "$SUMMARY_FILE"
else
  echo "_No screenshots captured_" >> "$SUMMARY_FILE"
fi
