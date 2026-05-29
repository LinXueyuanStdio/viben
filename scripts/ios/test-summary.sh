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

# Max image size in bytes (512KB)
MAX_SIZE=524288

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
# Screenshots (3-column table with compressed base64 images)
# =============================================================================
echo "### 📸 Screenshots" >> "$SUMMARY_FILE"
echo "" >> "$SUMMARY_FILE"

# Function to compress image to target size (macOS version using sips)
compress_image() {
  local input="$1"
  local output="$2"
  local max_size="$3"

  # Start with width 400, reduce if needed
  local width=400

  while [ $width -ge 100 ]; do
    if command -v sips &>/dev/null; then
      # sips for macOS - resize and convert to JPEG
      sips -Z $width "$input" --out "$output" -s format jpeg -s formatOptions 80 &>/dev/null 2>&1 || \
      sips -Z $width "$input" --out "$output" &>/dev/null 2>&1 || \
      cp "$input" "$output"
    elif command -v convert &>/dev/null; then
      convert "$input" -resize "${width}x>" -quality 80 "$output" 2>/dev/null
    else
      cp "$input" "$output"
      return
    fi

    local size
    size=$(stat -f%z "$output" 2>/dev/null || stat -c%s "$output" 2>/dev/null || echo "999999")

    if [ "$size" -le "$max_size" ]; then
      return
    fi

    width=$((width - 100))
  done
}

# Collect screenshots using glob pattern
# shellcheck disable=SC2206
SCREENSHOTS=($SCREENSHOTS_PATTERN)

# Check if glob expanded (file exists)
if [ -e "${SCREENSHOTS[0]:-}" ]; then
  echo "| Screenshot 1 | Screenshot 2 | Screenshot 3 |" >> "$SUMMARY_FILE"
  echo "|:------------:|:------------:|:------------:|" >> "$SUMMARY_FILE"

  TEMP_DIR=$(mktemp -d)
  trap "rm -rf '$TEMP_DIR'" EXIT

  for ((i=0; i<${#SCREENSHOTS[@]}; i+=3)); do
    ROW="|"
    for ((j=0; j<3; j++)); do
      IDX=$((i+j))
      if [ $IDX -lt ${#SCREENSHOTS[@]} ]; then
        IMG="${SCREENSHOTS[$IDX]}"
        NAME=$(basename "$IMG")
        TEMP_IMG="$TEMP_DIR/compressed_${IDX}.jpg"

        # Compress image
        compress_image "$IMG" "$TEMP_IMG" "$MAX_SIZE"

        # Base64 encode (macOS uses -i flag)
        if [ -f "$TEMP_IMG" ]; then
          B64=$(base64 -i "$TEMP_IMG" 2>/dev/null | tr -d '\n\r' || base64 "$TEMP_IMG" | tr -d '\n\r')
          ROW="${ROW} <img src=\"data:image/jpeg;base64,${B64}\" alt=\"${NAME}\" width=\"250\"/> |"
        else
          ROW="${ROW} ${NAME} |"
        fi
      else
        ROW="${ROW} |"
      fi
    done
    echo "$ROW" >> "$SUMMARY_FILE"
  done

  echo "" >> "$SUMMARY_FILE"
  echo "_${#SCREENSHOTS[@]} screenshot(s) captured_" >> "$SUMMARY_FILE"
else
  echo "_No screenshots captured_" >> "$SUMMARY_FILE"
fi
