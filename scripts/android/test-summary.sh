#!/bin/bash
# Generate GitHub Job Summary for Android test results
# Usage: ./test-summary.sh [screenshots_dir] [maestro_results] [crash_log]
#
# Environment variables:
#   GITHUB_REPOSITORY  - Repository in format owner/repo
#   GITHUB_RUN_ID      - Workflow run ID
#   GITHUB_TOKEN       - GitHub token for uploading assets
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
# Screenshots
# =============================================================================
echo "### 📸 Screenshots" >> "$SUMMARY_FILE"
echo "" >> "$SUMMARY_FILE"

# Collect screenshots
if [ -d "$SCREENSHOTS_DIR" ]; then
  mapfile -t SCREENSHOTS < <(find "$SCREENSHOTS_DIR" -name "*.png" -type f 2>/dev/null | sort)
else
  SCREENSHOTS=()
fi

if [ ${#SCREENSHOTS[@]} -eq 0 ]; then
  echo "_No screenshots captured_" >> "$SUMMARY_FILE"
  exit 0
fi

# Check if we can upload to GitHub
if [ -z "${GITHUB_REPOSITORY:-}" ] || [ -z "${GITHUB_RUN_ID:-}" ] || [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "_Screenshots available in artifacts (upload not configured)_" >> "$SUMMARY_FILE"
  exit 0
fi

# Create temp directory for compressed images
TEMP_DIR=$(mktemp -d)
trap "rm -rf '$TEMP_DIR'" EXIT

echo "| Screenshot 1 | Screenshot 2 | Screenshot 3 |" >> "$SUMMARY_FILE"
echo "|:------------:|:------------:|:------------:|" >> "$SUMMARY_FILE"

for ((i=0; i<${#SCREENSHOTS[@]}; i+=3)); do
  ROW="|"
  for ((j=0; j<3; j++)); do
    IDX=$((i+j))
    if [ $IDX -lt ${#SCREENSHOTS[@]} ]; then
      IMG="${SCREENSHOTS[$IDX]}"
      NAME=$(basename "$IMG" .png)
      TEMP_FILE="$TEMP_DIR/${NAME}.jpg"

      # Compress image
      if command -v convert &>/dev/null; then
        convert "$IMG" -resize "600x>" -quality 85 "$TEMP_FILE" 2>/dev/null || cp "$IMG" "$TEMP_FILE"
      else
        cp "$IMG" "$TEMP_FILE"
      fi

      # Base64 encode
      CONTENT=$(base64 -w 0 "$TEMP_FILE" 2>/dev/null || base64 "$TEMP_FILE" | tr -d '\n')

      # Upload path
      UPLOAD_PATH="android/${GITHUB_RUN_ID}/${NAME}.jpg"
      API_URL="https://api.github.com/repos/${GITHUB_REPOSITORY}/contents/${UPLOAD_PATH}"

      # Create JSON payload file to avoid shell escaping issues
      PAYLOAD_FILE="$TEMP_DIR/payload_${IDX}.json"
      cat > "$PAYLOAD_FILE" << EOJSON
{
  "message": "Add screenshot ${NAME}",
  "content": "${CONTENT}",
  "branch": "ci-assets"
}
EOJSON

      # Upload to GitHub
      RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT "$API_URL" \
        -H "Authorization: token ${GITHUB_TOKEN}" \
        -H "Accept: application/vnd.github.v3+json" \
        -H "Content-Type: application/json" \
        -d @"$PAYLOAD_FILE" 2>&1)

      HTTP_CODE=$(echo "$RESPONSE" | tail -1)
      BODY=$(echo "$RESPONSE" | sed '$d')

      if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "200" ]; then
        URL="https://raw.githubusercontent.com/${GITHUB_REPOSITORY}/ci-assets/${UPLOAD_PATH}"
        ROW="${ROW} ![${NAME}](${URL}) |"
      else
        echo "::warning::Failed to upload ${NAME}.jpg (HTTP $HTTP_CODE): $BODY" >&2
        ROW="${ROW} \`${NAME}.png\` |"
      fi
    else
      ROW="${ROW} |"
    fi
  done
  echo "$ROW" >> "$SUMMARY_FILE"
done

echo "" >> "$SUMMARY_FILE"
echo "_${#SCREENSHOTS[@]} screenshot(s) captured_" >> "$SUMMARY_FILE"
