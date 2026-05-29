#!/bin/bash
# Generate GitHub Job Summary for iOS test results
# Usage: ./test-summary.sh [options]
#
# Environment variables:
#   SIMULATOR_NAME     - Name of the iOS simulator
#   APP_VERSION        - App version string
#   BUNDLE_ID          - App bundle identifier
#   GITHUB_REPOSITORY  - Repository in format owner/repo
#   GITHUB_RUN_ID      - Workflow run ID
#   GITHUB_TOKEN       - GitHub token for uploading assets
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

# Collect screenshots using glob pattern
# shellcheck disable=SC2206
SCREENSHOTS=($SCREENSHOTS_PATTERN)

# Check if glob expanded (file exists)
if [ ! -e "${SCREENSHOTS[0]:-}" ]; then
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

      # Compress image (macOS uses sips)
      if command -v sips &>/dev/null; then
        sips -Z 600 "$IMG" --out "$TEMP_FILE" -s format jpeg -s formatOptions 85 &>/dev/null 2>&1 || \
        sips -Z 600 "$IMG" --out "$TEMP_FILE" &>/dev/null 2>&1 || \
        cp "$IMG" "$TEMP_FILE"
      elif command -v convert &>/dev/null; then
        convert "$IMG" -resize "600x>" -quality 85 "$TEMP_FILE" 2>/dev/null || cp "$IMG" "$TEMP_FILE"
      else
        cp "$IMG" "$TEMP_FILE"
      fi

      # Base64 encode (macOS uses -i flag)
      CONTENT=$(base64 -i "$TEMP_FILE" 2>/dev/null | tr -d '\n' || base64 "$TEMP_FILE" | tr -d '\n')

      # Upload path
      UPLOAD_PATH="ios/${GITHUB_RUN_ID}/${NAME}.jpg"
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
