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

echo "## Android Test Results" >> "$SUMMARY_FILE"
echo "" >> "$SUMMARY_FILE"

# =============================================================================
# Maestro Test Results
# =============================================================================
if [ -f "$MAESTRO_RESULTS" ]; then
  # Use grep -o with sed as fallback for systems without -P flag
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
# Screenshots (3-column table with base64 encoded images)
# =============================================================================
echo "### 📸 Screenshots" >> "$SUMMARY_FILE"
echo "" >> "$SUMMARY_FILE"

# Collect screenshots
mapfile -t SCREENSHOTS < <(find "$SCREENSHOTS_DIR" -name "*.png" -type f 2>/dev/null | sort)

if [ ${#SCREENSHOTS[@]} -gt 0 ]; then
  echo "| Screenshot 1 | Screenshot 2 | Screenshot 3 |" >> "$SUMMARY_FILE"
  echo "|:------------:|:------------:|:------------:|" >> "$SUMMARY_FILE"

  for ((i=0; i<${#SCREENSHOTS[@]}; i+=3)); do
    ROW="|"
    for ((j=0; j<3; j++)); do
      IDX=$((i+j))
      if [ $IDX -lt ${#SCREENSHOTS[@]} ]; then
        IMG="${SCREENSHOTS[$IDX]}"
        NAME=$(basename "$IMG")

        # Create temp file for resized image
        TEMP_IMG=$(mktemp --suffix=.png)
        trap "rm -f '$TEMP_IMG'" EXIT

        # Try to resize image (ImageMagick or fallback to original)
        if command -v convert &>/dev/null; then
          # ImageMagick: resize to max 300px width, preserve aspect ratio
          convert "$IMG" -resize '300x>' -quality 85 "$TEMP_IMG" 2>/dev/null || cp "$IMG" "$TEMP_IMG"
        elif command -v ffmpeg &>/dev/null; then
          # ffmpeg fallback
          ffmpeg -i "$IMG" -vf "scale='min(300,iw)':-1" -y "$TEMP_IMG" 2>/dev/null || cp "$IMG" "$TEMP_IMG"
        else
          cp "$IMG" "$TEMP_IMG"
        fi

        # Base64 encode (works on both Linux and macOS)
        if command -v base64 &>/dev/null; then
          # Linux base64 uses -w 0, macOS uses -b 0 or no flag
          B64=$(base64 -w 0 "$TEMP_IMG" 2>/dev/null || base64 "$TEMP_IMG" | tr -d '\n')
        else
          echo "Warning: base64 command not found" >&2
          B64=""
        fi

        rm -f "$TEMP_IMG"

        if [ -n "$B64" ]; then
          ROW="$ROW <img src=\"data:image/png;base64,${B64}\" alt=\"${NAME}\" width=\"300\"/> |"
        else
          ROW="$ROW ${NAME} |"
        fi
      else
        ROW="$ROW |"
      fi
    done
    echo "$ROW" >> "$SUMMARY_FILE"
  done

  echo "" >> "$SUMMARY_FILE"
  echo "_${#SCREENSHOTS[@]} screenshot(s) captured_" >> "$SUMMARY_FILE"
else
  echo "_No screenshots captured_" >> "$SUMMARY_FILE"
fi
