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

echo "## 🤖 Android Test Results" >> "$SUMMARY_FILE"
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

# Collect screenshots
if [ -d "$SCREENSHOTS_DIR" ]; then
  mapfile -t SCREENSHOTS < <(find "$SCREENSHOTS_DIR" -name "*.png" -type f 2>/dev/null | sort)
else
  SCREENSHOTS=()
fi

if [ ${#SCREENSHOTS[@]} -gt 0 ]; then
  echo "> 📥 Download the **android-test-screenshots** artifact to view images" >> "$SUMMARY_FILE"
  echo "" >> "$SUMMARY_FILE"
  echo "| # | Screenshot | Size |" >> "$SUMMARY_FILE"
  echo "|---|------------|------|" >> "$SUMMARY_FILE"

  for i in "${!SCREENSHOTS[@]}"; do
    IMG="${SCREENSHOTS[$i]}"
    NAME=$(basename "$IMG")
    SIZE=$(du -h "$IMG" 2>/dev/null | cut -f1 || echo "N/A")
    echo "| $((i+1)) | \`${NAME}\` | ${SIZE} |" >> "$SUMMARY_FILE"
  done

  echo "" >> "$SUMMARY_FILE"
  echo "_${#SCREENSHOTS[@]} screenshot(s) captured_" >> "$SUMMARY_FILE"
else
  echo "_No screenshots captured_" >> "$SUMMARY_FILE"
fi
