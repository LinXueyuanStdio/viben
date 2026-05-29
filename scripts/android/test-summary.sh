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

# Function to upload image to GitHub and get URL
upload_to_github() {
  local file="$1"
  local filename="$2"

  # Check if we have required env vars
  if [ -z "${GITHUB_REPOSITORY:-}" ] || [ -z "${GITHUB_RUN_ID:-}" ] || [ -z "${GITHUB_TOKEN:-}" ]; then
    return 1
  fi

  # Compress image first
  local temp_file
  temp_file=$(mktemp --suffix=.jpg)
  trap "rm -f '$temp_file'" RETURN

  if command -v convert &>/dev/null; then
    convert "$file" -resize "600x>" -quality 85 "$temp_file" 2>/dev/null || cp "$file" "$temp_file"
  else
    cp "$file" "$temp_file"
  fi

  # Upload to ci-assets branch using GitHub API
  local content
  content=$(base64 -w 0 "$temp_file" 2>/dev/null || base64 "$temp_file" | tr -d '\n')

  local path="android/${GITHUB_RUN_ID}/${filename}.jpg"
  local api_url="https://api.github.com/repos/${GITHUB_REPOSITORY}/contents/${path}"

  # Try to create/update file in ci-assets branch
  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$api_url" \
    -H "Authorization: token ${GITHUB_TOKEN}" \
    -H "Accept: application/vnd.github.v3+json" \
    -d "{\"message\":\"Add screenshot ${filename}\",\"content\":\"${content}\",\"branch\":\"ci-assets\"}" 2>/dev/null || echo "000")

  if [ "$http_code" = "201" ] || [ "$http_code" = "200" ]; then
    # Return the raw URL directly
    echo "https://raw.githubusercontent.com/${GITHUB_REPOSITORY}/ci-assets/${path}"
    return 0
  else
    return 1
  fi
}

# Collect screenshots
if [ -d "$SCREENSHOTS_DIR" ]; then
  mapfile -t SCREENSHOTS < <(find "$SCREENSHOTS_DIR" -name "*.png" -type f 2>/dev/null | sort)
else
  SCREENSHOTS=()
fi

if [ ${#SCREENSHOTS[@]} -gt 0 ]; then
  # Check if we can upload to GitHub
  CAN_UPLOAD="false"
  if [ -n "${GITHUB_REPOSITORY:-}" ] && [ -n "${GITHUB_RUN_ID:-}" ] && [ -n "${GITHUB_TOKEN:-}" ]; then
    CAN_UPLOAD="true"
  fi

  UPLOAD_SUCCESS="false"

  echo "| Screenshot 1 | Screenshot 2 | Screenshot 3 |" >> "$SUMMARY_FILE"
  echo "|:------------:|:------------:|:------------:|" >> "$SUMMARY_FILE"

  for ((i=0; i<${#SCREENSHOTS[@]}; i+=3)); do
    ROW="|"
    for ((j=0; j<3; j++)); do
      IDX=$((i+j))
      if [ $IDX -lt ${#SCREENSHOTS[@]} ]; then
        IMG="${SCREENSHOTS[$IDX]}"
        NAME=$(basename "$IMG" .png)

        if [ "$CAN_UPLOAD" = "true" ]; then
          if URL=$(upload_to_github "$IMG" "$NAME"); then
            ROW="${ROW} ![${NAME}](${URL}) |"
            UPLOAD_SUCCESS="true"
          else
            ROW="${ROW} \`${NAME}.png\` |"
          fi
        else
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

  if [ "$UPLOAD_SUCCESS" != "true" ]; then
    echo "" >> "$SUMMARY_FILE"
    echo "> 📥 Download **android-test-screenshots** artifact to view images" >> "$SUMMARY_FILE"
  fi
else
  echo "_No screenshots captured_" >> "$SUMMARY_FILE"
fi
