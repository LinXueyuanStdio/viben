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

TEMP_DIR=$(mktemp -d)
trap "rm -rf '$TEMP_DIR'" EXIT

API_BASE="https://api.github.com/repos/${GITHUB_REPOSITORY}"
AUTH_HEADER="Authorization: token ${GITHUB_TOKEN}"
BRANCH="ci-assets"
UPLOAD_DIR="ios/${GITHUB_RUN_ID}"

# Step 1: Get current commit SHA of ci-assets branch
BASE_SHA=$(curl -s -H "$AUTH_HEADER" "${API_BASE}/git/ref/heads/${BRANCH}" | grep -oE '"sha":\s*"[a-f0-9]+"' | head -1 | cut -d'"' -f4)
if [ -z "$BASE_SHA" ]; then
  echo "::error::Failed to get base SHA for ${BRANCH} branch" >&2
  echo "_Failed to upload screenshots_" >> "$SUMMARY_FILE"
  exit 0
fi

# Step 2: Get base tree SHA
BASE_TREE=$(curl -s -H "$AUTH_HEADER" "${API_BASE}/git/commits/${BASE_SHA}" | grep -oE '"sha":\s*"[a-f0-9]+"' | head -2 | tail -1 | cut -d'"' -f4)

# Step 3: Create blobs and build tree entries
TREE_ENTRIES="["
UPLOADED_FILES=()

for IMG in "${SCREENSHOTS[@]}"; do
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

  # Create blob
  BLOB_RESPONSE=$(curl -s -X POST "${API_BASE}/git/blobs" \
    -H "$AUTH_HEADER" \
    -H "Content-Type: application/json" \
    -d "{\"content\":\"${CONTENT}\",\"encoding\":\"base64\"}")

  BLOB_SHA=$(echo "$BLOB_RESPONSE" | grep -oE '"sha":\s*"[a-f0-9]+"' | head -1 | cut -d'"' -f4)

  if [ -n "$BLOB_SHA" ]; then
    [ ${#UPLOADED_FILES[@]} -gt 0 ] && TREE_ENTRIES="${TREE_ENTRIES},"
    TREE_ENTRIES="${TREE_ENTRIES}{\"path\":\"${UPLOAD_DIR}/${NAME}.jpg\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"${BLOB_SHA}\"}"
    UPLOADED_FILES+=("${NAME}")
  fi
done

TREE_ENTRIES="${TREE_ENTRIES}]"

if [ ${#UPLOADED_FILES[@]} -eq 0 ]; then
  echo "::error::Failed to create any blobs" >&2
  echo "_Failed to upload screenshots_" >> "$SUMMARY_FILE"
  exit 0
fi

# Step 4: Create tree
TREE_RESPONSE=$(curl -s -X POST "${API_BASE}/git/trees" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d "{\"base_tree\":\"${BASE_TREE}\",\"tree\":${TREE_ENTRIES}}")

TREE_SHA=$(echo "$TREE_RESPONSE" | grep -oE '"sha":\s*"[a-f0-9]+"' | head -1 | cut -d'"' -f4)

if [ -z "$TREE_SHA" ]; then
  echo "::error::Failed to create tree: $TREE_RESPONSE" >&2
  echo "_Failed to upload screenshots_" >> "$SUMMARY_FILE"
  exit 0
fi

# Step 5: Create commit
COMMIT_RESPONSE=$(curl -s -X POST "${API_BASE}/git/commits" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"Add ${#UPLOADED_FILES[@]} iOS screenshots (run ${GITHUB_RUN_ID})\",\"tree\":\"${TREE_SHA}\",\"parents\":[\"${BASE_SHA}\"]}")

COMMIT_SHA=$(echo "$COMMIT_RESPONSE" | grep -oE '"sha":\s*"[a-f0-9]+"' | head -1 | cut -d'"' -f4)

if [ -z "$COMMIT_SHA" ]; then
  echo "::error::Failed to create commit: $COMMIT_RESPONSE" >&2
  echo "_Failed to upload screenshots_" >> "$SUMMARY_FILE"
  exit 0
fi

# Step 6: Update branch reference
UPDATE_RESPONSE=$(curl -s -X PATCH "${API_BASE}/git/refs/heads/${BRANCH}" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d "{\"sha\":\"${COMMIT_SHA}\"}")

# Generate markdown table
echo "| Screenshot 1 | Screenshot 2 | Screenshot 3 |" >> "$SUMMARY_FILE"
echo "|:------------:|:------------:|:------------:|" >> "$SUMMARY_FILE"

for ((i=0; i<${#UPLOADED_FILES[@]}; i+=3)); do
  ROW="|"
  for ((j=0; j<3; j++)); do
    IDX=$((i+j))
    if [ $IDX -lt ${#UPLOADED_FILES[@]} ]; then
      NAME="${UPLOADED_FILES[$IDX]}"
      URL="https://raw.githubusercontent.com/${GITHUB_REPOSITORY}/${BRANCH}/${UPLOAD_DIR}/${NAME}.jpg"
      ROW="${ROW} ![${NAME}](${URL}) |"
    else
      ROW="${ROW} |"
    fi
  done
  echo "$ROW" >> "$SUMMARY_FILE"
done

echo "" >> "$SUMMARY_FILE"
echo "_${#UPLOADED_FILES[@]} screenshot(s) uploaded_" >> "$SUMMARY_FILE"
