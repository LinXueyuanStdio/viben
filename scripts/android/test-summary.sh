#!/bin/bash
# Generate GitHub Job Summary for Android test results
# Usage: ./test-summary.sh [screenshots_dir] [maestro_results] [crash_log]
#
# Arguments:
#   screenshots_dir  - Directory containing PNG screenshots (default: test-screenshots)
#   maestro_results  - Path to Maestro JUnit XML results (default: maestro-results.xml)
#   crash_log        - Path to crash log file (default: test-logs/crash-log.txt)

set -euo pipefail

SCREENSHOTS_DIR="${1:-test-screenshots}"
MAESTRO_RESULTS="${2:-maestro-results.xml}"
CRASH_LOG="${3:-test-logs/crash-log.txt}"

# Output file (GitHub Actions sets this automatically)
SUMMARY_FILE="${GITHUB_STEP_SUMMARY:-/dev/stdout}"

# Max image size in bytes (512KB)
MAX_SIZE=524288

echo "## 🤖 Android Test Results" >> "$SUMMARY_FILE"
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

# Function to compress image to target size
compress_image() {
  local input="$1"
  local output="$2"
  local max_size="$3"

  # Start with width 400, reduce if needed
  local width=400
  local quality=80

  while [ $width -ge 100 ]; do
    if command -v convert &>/dev/null; then
      convert "$input" -resize "${width}x>" -quality $quality "$output" 2>/dev/null
    else
      cp "$input" "$output"
      return
    fi

    local size
    size=$(stat -c%s "$output" 2>/dev/null || stat -f%z "$output" 2>/dev/null || echo "999999")

    if [ "$size" -le "$max_size" ]; then
      return
    fi

    # Reduce quality first, then width
    if [ $quality -gt 40 ]; then
      quality=$((quality - 20))
    else
      width=$((width - 100))
      quality=80
    fi
  done
}

# Collect screenshots
if [ -d "$SCREENSHOTS_DIR" ]; then
  mapfile -t SCREENSHOTS < <(find "$SCREENSHOTS_DIR" -name "*.png" -type f 2>/dev/null | sort)
else
  SCREENSHOTS=()
fi

if [ ${#SCREENSHOTS[@]} -gt 0 ]; then
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

        # Base64 encode
        if [ -f "$TEMP_IMG" ]; then
          B64=$(base64 -w 0 "$TEMP_IMG" 2>/dev/null || base64 "$TEMP_IMG" | tr -d '\n\r')
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
