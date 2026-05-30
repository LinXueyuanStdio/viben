#!/bin/bash
# Generate GitHub Job Summary for iOS test results
# Usage: ./test-summary.sh [options]

set -euo pipefail

SCREENSHOTS_PATTERN="ios-screenshot*.png"
MAESTRO_RESULTS="maestro-ios-results.xml"
CRASH_LOG="ios-crash-log.txt"

while [[ $# -gt 0 ]]; do
  case $1 in
    --screenshots-pattern) SCREENSHOTS_PATTERN="$2"; shift 2 ;;
    --maestro-results) MAESTRO_RESULTS="$2"; shift 2 ;;
    --crash-log) CRASH_LOG="$2"; shift 2 ;;
    *) shift ;;
  esac
done

SUMMARY_FILE="${GITHUB_STEP_SUMMARY:-/dev/stdout}"

json_get() {
  local json="$1" key="$2"
  if command -v jq &>/dev/null; then
    echo "$json" | jq -r ".$key // empty"
  else
    echo "$json" | grep -oE "\"$key\":\s*\"[^\"]+\"" | head -1 | cut -d'"' -f4
  fi
}

# Screenshot name to Chinese description mapping
get_screenshot_desc() {
  local name="$1"
  case "$name" in
    *-01-launched*)    echo "应用启动" ;;
    *-02-relaunched*)  echo "重新启动" ;;
    *-03-deeplink*)    echo "深度链接" ;;
    *-final*)          echo "最终状态" ;;
    *home*)            echo "主页" ;;
    *settings*)        echo "设置页" ;;
    *chat*)            echo "对话页" ;;
    *workspace*)       echo "工作区" ;;
    *error*)           echo "错误状态" ;;
    *)                 echo "${name##*-}" ;;
  esac
}

echo "## iOS E2E 测试报告" >> "$SUMMARY_FILE"
echo "" >> "$SUMMARY_FILE"

# =============================================================================
# Test Environment
# =============================================================================
echo "### 测试环境" >> "$SUMMARY_FILE"
echo "" >> "$SUMMARY_FILE"
echo "| 配置 | 值 |" >> "$SUMMARY_FILE"
echo "|------|-----|" >> "$SUMMARY_FILE"
echo "| 模拟器 | ${SIMULATOR_NAME:-N/A} |" >> "$SUMMARY_FILE"

# Get Xcode version
XCODE_VER=$(xcodebuild -version 2>/dev/null | head -1 || echo "")
[ -n "$XCODE_VER" ] && echo "| Xcode | $XCODE_VER |" >> "$SUMMARY_FILE"

echo "| 版本 | ${APP_VERSION:-N/A} |" >> "$SUMMARY_FILE"
echo "| Bundle | \`${BUNDLE_ID:-N/A}\` |" >> "$SUMMARY_FILE"
[ -n "${GITHUB_RUN_ID:-}" ] && echo "| 运行 | [#${GITHUB_RUN_ID}](https://github.com/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}) |" >> "$SUMMARY_FILE"
echo "" >> "$SUMMARY_FILE"

# =============================================================================
# Maestro Test Results
# =============================================================================
if [ -f "$MAESTRO_RESULTS" ]; then
  TESTS=$(grep -oE 'tests="[0-9]+"' "$MAESTRO_RESULTS" | head -1 | grep -oE '[0-9]+' || echo "0")
  FAILURES=$(grep -oE 'failures="[0-9]+"' "$MAESTRO_RESULTS" | head -1 | grep -oE '[0-9]+' || echo "0")
  ERRORS=$(grep -oE 'errors="[0-9]+"' "$MAESTRO_RESULTS" | head -1 | grep -oE '[0-9]+' || echo "0")
  TIME=$(grep -oE 'time="[0-9.]+"' "$MAESTRO_RESULTS" | head -1 | grep -oE '[0-9.]+' || echo "")

  if [ "${FAILURES:-0}" = "0" ] && [ "${ERRORS:-0}" = "0" ]; then
    echo "### 测试通过" >> "$SUMMARY_FILE"
  else
    echo "### 测试失败" >> "$SUMMARY_FILE"
  fi
  echo "" >> "$SUMMARY_FILE"
  echo "| 指标 | 数量 |" >> "$SUMMARY_FILE"
  echo "|------|------|" >> "$SUMMARY_FILE"
  echo "| 用例 | ${TESTS:-0} |" >> "$SUMMARY_FILE"
  echo "| 失败 | ${FAILURES:-0} |" >> "$SUMMARY_FILE"
  echo "| 错误 | ${ERRORS:-0} |" >> "$SUMMARY_FILE"
  [ -n "$TIME" ] && echo "| 耗时 | ${TIME}s |" >> "$SUMMARY_FILE"
  echo "" >> "$SUMMARY_FILE"
else
  echo "### 无测试数据" >> "$SUMMARY_FILE"
  echo "" >> "$SUMMARY_FILE"
fi

# =============================================================================
# Crash Detection
# =============================================================================
if [ -f "$CRASH_LOG" ]; then
  echo "### 应用崩溃" >> "$SUMMARY_FILE"
  echo "" >> "$SUMMARY_FILE"
  echo "<details><summary>崩溃日志</summary>" >> "$SUMMARY_FILE"
  echo "" >> "$SUMMARY_FILE"
  echo '```' >> "$SUMMARY_FILE"
  head -30 "$CRASH_LOG" >> "$SUMMARY_FILE"
  echo '```' >> "$SUMMARY_FILE"
  echo "</details>" >> "$SUMMARY_FILE"
  echo "" >> "$SUMMARY_FILE"
fi

# =============================================================================
# Screenshots
# =============================================================================
echo "### 测试截图" >> "$SUMMARY_FILE"
echo "" >> "$SUMMARY_FILE"

shopt -s nullglob
SCREENSHOTS=($SCREENSHOTS_PATTERN)
shopt -u nullglob

if [ ${#SCREENSHOTS[@]} -eq 0 ]; then
  echo "_无截图_" >> "$SUMMARY_FILE"
  exit 0
fi

if [ -z "${GITHUB_REPOSITORY:-}" ] || [ -z "${GITHUB_RUN_ID:-}" ] || [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "_截图在 artifacts 中_" >> "$SUMMARY_FILE"
  exit 0
fi

TEMP_DIR=$(mktemp -d)
trap "rm -rf '$TEMP_DIR'" EXIT

API_BASE="https://api.github.com/repos/${GITHUB_REPOSITORY}"
AUTH_HEADER="Authorization: token ${GITHUB_TOKEN}"
BRANCH="ci-assets"
UPLOAD_DIR="ios/${GITHUB_RUN_ID}"

upload_screenshots() {
  local ref_response
  ref_response=$(curl -s -H "$AUTH_HEADER" "${API_BASE}/git/ref/heads/${BRANCH}")
  BASE_SHA=$(json_get "$ref_response" "object.sha")
  [ -z "$BASE_SHA" ] && BASE_SHA=$(echo "$ref_response" | grep -oE '"sha":\s*"[a-f0-9]+"' | head -1 | cut -d'"' -f4)
  [ -z "$BASE_SHA" ] && { echo "::error::Failed to get base SHA" >&2; return 1; }

  local commit_response
  commit_response=$(curl -s -H "$AUTH_HEADER" "${API_BASE}/git/commits/${BASE_SHA}")
  if command -v jq &>/dev/null; then
    BASE_TREE=$(echo "$commit_response" | jq -r '.tree.sha // empty')
  else
    BASE_TREE=$(echo "$commit_response" | grep -oE '"tree":\s*\{[^}]*"sha":\s*"[a-f0-9]+"' | grep -oE '"sha":\s*"[a-f0-9]+"' | cut -d'"' -f4)
  fi
  [ -z "$BASE_TREE" ] && { echo "::error::Failed to get base tree" >&2; return 1; }

  TREE_ENTRIES="["
  UPLOADED_FILES=()

  for IMG in "${SCREENSHOTS[@]}"; do
    NAME=$(basename "$IMG" .png)
    TEMP_FILE="$TEMP_DIR/${NAME}.jpg"

    if command -v sips &>/dev/null; then
      sips -Z 600 "$IMG" --out "$TEMP_FILE" -s format jpeg -s formatOptions 85 &>/dev/null 2>&1 || \
      sips -Z 600 "$IMG" --out "$TEMP_FILE" &>/dev/null 2>&1 || \
      cp "$IMG" "$TEMP_FILE"
    elif command -v convert &>/dev/null; then
      convert "$IMG" -resize "600x>" -quality 85 "$TEMP_FILE" 2>/dev/null || cp "$IMG" "$TEMP_FILE"
    else
      cp "$IMG" "$TEMP_FILE"
    fi

    CONTENT=$(base64 -i "$TEMP_FILE" 2>/dev/null | tr -d '\n' || base64 "$TEMP_FILE" | tr -d '\n')

    local blob_payload="$TEMP_DIR/blob_${NAME}.json"
    printf '{"content":"%s","encoding":"base64"}' "$CONTENT" > "$blob_payload"

    local blob_response
    blob_response=$(curl -s -X POST "${API_BASE}/git/blobs" -H "$AUTH_HEADER" -H "Content-Type: application/json" -d @"$blob_payload")
    BLOB_SHA=$(json_get "$blob_response" "sha")

    if [ -n "$BLOB_SHA" ]; then
      [ ${#UPLOADED_FILES[@]} -gt 0 ] && TREE_ENTRIES="${TREE_ENTRIES},"
      TREE_ENTRIES="${TREE_ENTRIES}{\"path\":\"${UPLOAD_DIR}/${NAME}.jpg\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"${BLOB_SHA}\"}"
      UPLOADED_FILES+=("${NAME}")
    fi
  done

  TREE_ENTRIES="${TREE_ENTRIES}]"
  [ ${#UPLOADED_FILES[@]} -eq 0 ] && { echo "::error::No blobs created" >&2; return 1; }

  local tree_response
  tree_response=$(curl -s -X POST "${API_BASE}/git/trees" -H "$AUTH_HEADER" -H "Content-Type: application/json" -d "{\"base_tree\":\"${BASE_TREE}\",\"tree\":${TREE_ENTRIES}}")
  TREE_SHA=$(json_get "$tree_response" "sha")
  [ -z "$TREE_SHA" ] && { echo "::error::Failed to create tree" >&2; return 1; }

  local commit_response
  commit_response=$(curl -s -X POST "${API_BASE}/git/commits" -H "$AUTH_HEADER" -H "Content-Type: application/json" -d "{\"message\":\"Add ${#UPLOADED_FILES[@]} iOS screenshots (run ${GITHUB_RUN_ID})\",\"tree\":\"${TREE_SHA}\",\"parents\":[\"${BASE_SHA}\"]}")
  COMMIT_SHA=$(json_get "$commit_response" "sha")
  [ -z "$COMMIT_SHA" ] && { echo "::error::Failed to create commit" >&2; return 1; }

  local update_response http_code
  update_response=$(curl -s -w "\n%{http_code}" -X PATCH "${API_BASE}/git/refs/heads/${BRANCH}" -H "$AUTH_HEADER" -H "Content-Type: application/json" -d "{\"sha\":\"${COMMIT_SHA}\",\"force\":false}")
  http_code=$(echo "$update_response" | tail -1)
  [ "$http_code" != "200" ] && { echo "::warning::Ref update HTTP $http_code" >&2; return 2; }

  return 0
}

MAX_RETRIES=3
UPLOAD_SUCCESS=false
for attempt in $(seq 1 $MAX_RETRIES); do
  if upload_screenshots; then
    UPLOAD_SUCCESS=true
    break
  elif [ $? -eq 2 ] && [ $attempt -lt $MAX_RETRIES ]; then
    sleep "$attempt"
  fi
done

if [ "$UPLOAD_SUCCESS" != "true" ]; then
  echo "_上传失败_" >> "$SUMMARY_FILE"
  exit 0
fi

echo "| 步骤 | 截图 | 说明 |" >> "$SUMMARY_FILE"
echo "|:----:|:----:|:-----|" >> "$SUMMARY_FILE"

STEP_NUM=1
for NAME in "${UPLOADED_FILES[@]}"; do
  URL="https://raw.githubusercontent.com/${GITHUB_REPOSITORY}/${BRANCH}/${UPLOAD_DIR}/${NAME}.jpg"
  DESC=$(get_screenshot_desc "$NAME")

  if [[ "$NAME" == *"-final"* ]]; then
    STEP="最终"
  else
    STEP="$STEP_NUM"
    ((STEP_NUM++))
  fi

  echo "| $STEP | ![${DESC}](${URL}) | ${DESC} |" >> "$SUMMARY_FILE"
done

echo "" >> "$SUMMARY_FILE"
echo "_共 ${#UPLOADED_FILES[@]} 张截图_" >> "$SUMMARY_FILE"
