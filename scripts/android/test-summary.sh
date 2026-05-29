#!/bin/bash
# Generate GitHub Job Summary for Android test results
# Usage: ./test-summary.sh [screenshots_dir] [maestro_results] [crash_log]

set -euo pipefail

SCREENSHOTS_DIR="${1:-test-screenshots}"
MAESTRO_RESULTS="${2:-maestro-results.xml}"
CRASH_LOG="${3:-test-logs/crash-log.txt}"

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

TEMP_DIR=$(mktemp -d)
trap "rm -rf '$TEMP_DIR'" EXIT

API_BASE="https://api.github.com/repos/${GITHUB_REPOSITORY}"
AUTH_HEADER="Authorization: token ${GITHUB_TOKEN}"
BRANCH="ci-assets"
UPLOAD_DIR="android/${GITHUB_RUN_ID}"

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

  # Compress image
  if command -v convert &>/dev/null; then
    convert "$IMG" -resize "600x>" -quality 85 "$TEMP_FILE" 2>/dev/null || cp "$IMG" "$TEMP_FILE"
  else
    cp "$IMG" "$TEMP_FILE"
  fi

  # Base64 encode
  CONTENT=$(base64 -w 0 "$TEMP_FILE" 2>/dev/null || base64 "$TEMP_FILE" | tr -d '\n')

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
  -d "{\"message\":\"Add ${#UPLOADED_FILES[@]} Android screenshots (run ${GITHUB_RUN_ID})\",\"tree\":\"${TREE_SHA}\",\"parents\":[\"${BASE_SHA}\"]}")

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
