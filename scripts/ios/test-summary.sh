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

# Function to upload image to GitHub and get URL
upload_to_github() {
  local file="$1"
  local filename="$2"

  # Check if we have required env vars
  if [ -z "${GITHUB_REPOSITORY:-}" ] || [ -z "${GITHUB_RUN_ID:-}" ] || [ -z "${GITHUB_TOKEN:-}" ]; then
    echo ""
    return
  fi

  # Compress image first
  local temp_file
  temp_file=$(mktemp).jpg

  if command -v sips &>/dev/null; then
    sips -Z 600 "$file" --out "$temp_file" -s format jpeg -s formatOptions 85 &>/dev/null 2>&1 || \
    sips -Z 600 "$file" --out "$temp_file" &>/dev/null 2>&1 || \
    cp "$file" "$temp_file"
  elif command -v convert &>/dev/null; then
    convert "$file" -resize "600x>" -quality 85 "$temp_file" 2>/dev/null || cp "$file" "$temp_file"
  else
    cp "$file" "$temp_file"
  fi

  # Upload to ci-assets branch using GitHub API
  local content
  content=$(base64 -i "$temp_file" 2>/dev/null | tr -d '\n' || base64 "$temp_file" | tr -d '\n')

  local path="ios/${GITHUB_RUN_ID}/${filename}"
  local api_url="https://api.github.com/repos/${GITHUB_REPOSITORY}/contents/${path}"

  # Try to create/update file in ci-assets branch
  local response
  response=$(curl -s -X PUT "$api_url" \
    -H "Authorization: token ${GITHUB_TOKEN}" \
    -H "Accept: application/vnd.github.v3+json" \
    -d "{\"message\":\"Add screenshot ${filename}\",\"content\":\"${content}\",\"branch\":\"ci-assets\"}" 2>/dev/null || echo "")

  rm -f "$temp_file"

  # Extract download URL from response
  local download_url
  download_url=$(echo "$response" | grep -oE '"download_url":\s*"[^"]+"' | head -1 | cut -d'"' -f4 || echo "")

  if [ -n "$download_url" ]; then
    echo "$download_url"
  else
    echo ""
  fi
}

# Collect screenshots using glob pattern
# shellcheck disable=SC2206
SCREENSHOTS=($SCREENSHOTS_PATTERN)

# Check if glob expanded (file exists)
if [ -e "${SCREENSHOTS[0]:-}" ]; then
  # Check if we can upload to GitHub
  CAN_UPLOAD="false"
  if [ -n "${GITHUB_REPOSITORY:-}" ] && [ -n "${GITHUB_RUN_ID:-}" ] && [ -n "${GITHUB_TOKEN:-}" ]; then
    CAN_UPLOAD="true"
  fi

  echo "| Screenshot 1 | Screenshot 2 | Screenshot 3 |" >> "$SUMMARY_FILE"
  echo "|:------------:|:------------:|:------------:|" >> "$SUMMARY_FILE"

  for ((i=0; i<${#SCREENSHOTS[@]}; i+=3)); do
    ROW="|"
    for ((j=0; j<3; j++)); do
      IDX=$((i+j))
      if [ $IDX -lt ${#SCREENSHOTS[@]} ]; then
        IMG="${SCREENSHOTS[$IDX]}"
        NAME=$(basename "$IMG")

        if [ "$CAN_UPLOAD" = "true" ]; then
          URL=$(upload_to_github "$IMG" "$NAME")
          if [ -n "$URL" ]; then
            ROW="${ROW} ![${NAME}](${URL}) |"
          else
            ROW="${ROW} \`${NAME}\` |"
          fi
        else
          ROW="${ROW} \`${NAME}\` |"
        fi
      else
        ROW="${ROW} |"
      fi
    done
    echo "$ROW" >> "$SUMMARY_FILE"
  done

  echo "" >> "$SUMMARY_FILE"
  echo "_${#SCREENSHOTS[@]} screenshot(s) captured_" >> "$SUMMARY_FILE"

  if [ "$CAN_UPLOAD" != "true" ]; then
    echo "" >> "$SUMMARY_FILE"
    echo "> 📥 Download **ios-test-results** artifact to view images" >> "$SUMMARY_FILE"
  fi
else
  echo "_No screenshots captured_" >> "$SUMMARY_FILE"
fi
