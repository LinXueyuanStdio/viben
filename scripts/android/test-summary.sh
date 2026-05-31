#!/bin/bash
# Generate GitHub Job Summary for Android test results
# Usage: ./test-summary.sh [screenshots_dir] [maestro_results] [crash_log]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/upload-ci-assets.sh"

SCREENSHOTS_DIR="${1:-test-screenshots}"
MAESTRO_RESULTS="${2:-maestro-results.xml}"
CRASH_LOG="${3:-test-logs/crash-log.txt}"

SUMMARY_FILE="${GITHUB_STEP_SUMMARY:-/dev/stdout}"

# Screenshot name to Chinese description mapping
get_screenshot_desc() {
  local name="$1"
  case "$name" in
    *app-launched*|*01-*)    echo "应用启动" ;;
    *tab1*|*02-*)            echo "标签页1" ;;
    *tab2*|*03-*)            echo "标签页2" ;;
    *tab3*|*04-*)            echo "标签页3" ;;
    *center-tap*|*05-*)      echo "中心点击" ;;
    *after-back*|*06-*)      echo "返回后" ;;
    *resumed*|*07-*)         echo "恢复状态" ;;
    *final*|*08-*)           echo "最终状态" ;;
    *home*)                  echo "主页" ;;
    *settings*)              echo "设置页" ;;
    *chat*)                  echo "对话页" ;;
    *error*)                 echo "错误状态" ;;
    *)                       echo "${name##*-}" ;;
  esac
}

echo "## Android E2E 测试报告" >> "$SUMMARY_FILE"
echo "" >> "$SUMMARY_FILE"

# =============================================================================
# Test Environment
# =============================================================================
echo "### 测试环境" >> "$SUMMARY_FILE"
echo "" >> "$SUMMARY_FILE"
echo "| 配置 | 值 |" >> "$SUMMARY_FILE"
echo "|------|-----|" >> "$SUMMARY_FILE"
echo "| 系统 | Android 14 (API 34) |" >> "$SUMMARY_FILE"
echo "| 模拟器 | Pixel 6, x86_64 |" >> "$SUMMARY_FILE"
echo "| 框架 | Maestro |" >> "$SUMMARY_FILE"
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

if [ -d "$SCREENSHOTS_DIR" ]; then
  mapfile -t SCREENSHOTS < <(find "$SCREENSHOTS_DIR" -name "*.png" -type f 2>/dev/null | sort)
else
  SCREENSHOTS=()
fi

if [ ${#SCREENSHOTS[@]} -eq 0 ]; then
  echo "_无截图_" >> "$SUMMARY_FILE"
  exit 0
fi

if [ -z "${GITHUB_REPOSITORY:-}" ] || [ -z "${GITHUB_RUN_ID:-}" ] || [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "_截图在 artifacts 中_" >> "$SUMMARY_FILE"
  exit 0
fi

# Compress and prepare files for upload
TEMP_DIR=$(mktemp -d)
trap "rm -rf '$TEMP_DIR'" EXIT

COMPRESSED_FILES=()
for IMG in "${SCREENSHOTS[@]}"; do
  NAME=$(basename "$IMG" .png)
  TEMP_FILE="$TEMP_DIR/${NAME}.jpg"

  if command -v convert &>/dev/null; then
    convert "$IMG" -resize "600x>" -quality 85 "$TEMP_FILE" 2>/dev/null || cp "$IMG" "$TEMP_FILE"
  else
    cp "$IMG" "$TEMP_FILE"
  fi
  COMPRESSED_FILES+=("$TEMP_FILE")
done

# Upload to ci-assets
UPLOAD_DIR="android/${GITHUB_RUN_ID}"
if upload_to_ci_assets_with_retry "$UPLOAD_DIR" "${COMPRESSED_FILES[@]}"; then
  echo "| 步骤 | 截图 | 说明 |" >> "$SUMMARY_FILE"
  echo "|:----:|:----:|:-----|" >> "$SUMMARY_FILE"

  for ((i=0; i<${#UPLOADED_URLS[@]}; i++)); do
    URL="${UPLOADED_URLS[$i]}"
    NAME=$(basename "${COMPRESSED_FILES[$i]}" .jpg)
    DESC=$(get_screenshot_desc "$NAME")
    echo "| $((i+1)) | <img src=\"${URL}\" width=\"200\" alt=\"${DESC}\"> | ${DESC} |" >> "$SUMMARY_FILE"
  done

  echo "" >> "$SUMMARY_FILE"
  echo "_共 ${#UPLOADED_URLS[@]} 张截图_" >> "$SUMMARY_FILE"
else
  echo "_上传失败_" >> "$SUMMARY_FILE"
fi
