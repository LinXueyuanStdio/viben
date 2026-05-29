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

# JSON parsing helper (uses jq if available, falls back to grep)
json_get() {
  local json="$1" key="$2"
  if command -v jq &>/dev/null; then
    echo "$json" | jq -r ".$key // empty"
  else
    echo "$json" | grep -oE "\"$key\":\s*\"[^\"]+\"" | head -1 | cut -d'"' -f4
  fi
}

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

# Collect screenshots using glob pattern (with nullglob for safe expansion)
shopt -s nullglob
SCREENSHOTS=($SCREENSHOTS_PATTERN)
shopt -u nullglob

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
UPLOAD_DIR="ios/${GITHUB_RUN_ID}"

# =============================================================================
# Upload screenshots with retry logic for race conditions
# =============================================================================
upload_screenshots() {
  # Step 1: Get current commit SHA of ci-assets branch
  local ref_response
  ref_response=$(curl -s -H "$AUTH_HEADER" "${API_BASE}/git/ref/heads/${BRANCH}")
  BASE_SHA=$(json_get "$ref_response" "object.sha")
  if [ -z "$BASE_SHA" ]; then
    BASE_SHA=$(echo "$ref_response" | grep -oE '"sha":\s*"[a-f0-9]+"' | head -1 | cut -d'"' -f4)
  fi

  if [ -z "$BASE_SHA" ]; then
    echo "::error::Failed to get base SHA for ${BRANCH} branch" >&2
    return 1
  fi

  # Step 2: Get base tree SHA
  local commit_response
  commit_response=$(curl -s -H "$AUTH_HEADER" "${API_BASE}/git/commits/${BASE_SHA}")
  if command -v jq &>/dev/null; then
    BASE_TREE=$(echo "$commit_response" | jq -r '.tree.sha // empty')
  else
    BASE_TREE=$(echo "$commit_response" | grep -oE '"tree":\s*\{[^}]*"sha":\s*"[a-f0-9]+"' | grep -oE '"sha":\s*"[a-f0-9]+"' | cut -d'"' -f4)
  fi

  if [ -z "$BASE_TREE" ]; then
    echo "::error::Failed to get base tree SHA" >&2
    return 1
  fi

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

    # Create blob (use temp file to avoid "Argument list too long")
    local blob_payload_file="$TEMP_DIR/blob_${NAME}.json"
    printf '{"content":"%s","encoding":"base64"}' "$CONTENT" > "$blob_payload_file"

    local blob_response
    blob_response=$(curl -s -X POST "${API_BASE}/git/blobs" \
      -H "$AUTH_HEADER" \
      -H "Content-Type: application/json" \
      -d @"$blob_payload_file")

    BLOB_SHA=$(json_get "$blob_response" "sha")

    if [ -n "$BLOB_SHA" ]; then
      [ ${#UPLOADED_FILES[@]} -gt 0 ] && TREE_ENTRIES="${TREE_ENTRIES},"
      TREE_ENTRIES="${TREE_ENTRIES}{\"path\":\"${UPLOAD_DIR}/${NAME}.jpg\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"${BLOB_SHA}\"}"
      UPLOADED_FILES+=("${NAME}")
    fi
  done

  TREE_ENTRIES="${TREE_ENTRIES}]"

  if [ ${#UPLOADED_FILES[@]} -eq 0 ]; then
    echo "::error::Failed to create any blobs" >&2
    return 1
  fi

  # Step 4: Create tree
  local tree_response
  tree_response=$(curl -s -X POST "${API_BASE}/git/trees" \
    -H "$AUTH_HEADER" \
    -H "Content-Type: application/json" \
    -d "{\"base_tree\":\"${BASE_TREE}\",\"tree\":${TREE_ENTRIES}}")

  TREE_SHA=$(json_get "$tree_response" "sha")

  if [ -z "$TREE_SHA" ]; then
    echo "::error::Failed to create tree" >&2
    return 1
  fi

  # Step 5: Create commit
  local commit_create_response
  commit_create_response=$(curl -s -X POST "${API_BASE}/git/commits" \
    -H "$AUTH_HEADER" \
    -H "Content-Type: application/json" \
    -d "{\"message\":\"Add ${#UPLOADED_FILES[@]} iOS screenshots (run ${GITHUB_RUN_ID})\",\"tree\":\"${TREE_SHA}\",\"parents\":[\"${BASE_SHA}\"]}")

  COMMIT_SHA=$(json_get "$commit_create_response" "sha")

  if [ -z "$COMMIT_SHA" ]; then
    echo "::error::Failed to create commit" >&2
    return 1
  fi

  # Step 6: Update branch reference
  local update_response http_code
  update_response=$(curl -s -w "\n%{http_code}" -X PATCH "${API_BASE}/git/refs/heads/${BRANCH}" \
    -H "$AUTH_HEADER" \
    -H "Content-Type: application/json" \
    -d "{\"sha\":\"${COMMIT_SHA}\",\"force\":false}")

  http_code=$(echo "$update_response" | tail -1)

  if [ "$http_code" != "200" ]; then
    echo "::warning::Ref update returned HTTP $http_code (possible race condition)" >&2
    return 2
  fi

  return 0
}

# Retry loop for handling race conditions
MAX_RETRIES=3
UPLOAD_SUCCESS=false

for attempt in $(seq 1 $MAX_RETRIES); do
  if upload_screenshots; then
    UPLOAD_SUCCESS=true
    break
  else
    exit_code=$?
    if [ $exit_code -eq 2 ] && [ $attempt -lt $MAX_RETRIES ]; then
      echo "::warning::Upload attempt $attempt failed due to race condition, retrying in ${attempt}s..."
      sleep "$attempt"
    elif [ $attempt -eq $MAX_RETRIES ]; then
      echo "::error::Failed to upload screenshots after $MAX_RETRIES attempts"
    fi
  fi
done

if [ "$UPLOAD_SUCCESS" != "true" ]; then
  echo "_Failed to upload screenshots_" >> "$SUMMARY_FILE"
  exit 0
fi

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
