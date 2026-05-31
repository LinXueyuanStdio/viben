#!/bin/bash
# Generate GitHub Job Summary for macOS Desktop E2E test results
# Usage: ./test-desktop-summary.sh [screenshots_dir] [wdio_results_xml]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCREENSHOTS_DIR="${1:-test-screenshots}"
WDIO_RESULTS="${2:-wdio-results.xml}"

SUMMARY_FILE="${GITHUB_STEP_SUMMARY:-/dev/stdout}"

# Source the upload library
source "$SCRIPT_DIR/../lib/upload-ci-assets.sh"

# Screenshot name to Chinese description mapping
get_screenshot_desc() {
  local name="$1"
  case "$name" in
    *launch*|*main*|*window*)     echo "主窗口" ;;
    *content*|*area*)             echo "内容区域" ;;
    *error*|*console*)            echo "错误检查" ;;
    *nav*|*navigation*|*sidebar*) echo "导航栏" ;;
    *resize*|*responsive*)        echo "窗口调整" ;;
    *final*|*state*)              echo "最终状态" ;;
    *)                            echo "${name##*-}" ;;
  esac
}

echo "## macOS Desktop E2E 测试报告" >> "$SUMMARY_FILE"
echo "" >> "$SUMMARY_FILE"

# =============================================================================
# Test Environment
# =============================================================================
echo "### 测试环境" >> "$SUMMARY_FILE"
echo "" >> "$SUMMARY_FILE"
echo "| 配置 | 值 |" >> "$SUMMARY_FILE"
echo "|------|-----|" >> "$SUMMARY_FILE"
echo "| 系统 | macOS ARM64 |" >> "$SUMMARY_FILE"
echo "| 测试框架 | WebdriverIO + tauri-driver |" >> "$SUMMARY_FILE"
[ -n "${GITHUB_RUN_ID:-}" ] && echo "| 运行 | [#${GITHUB_RUN_ID}](https://github.com/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}) |" >> "$SUMMARY_FILE"
echo "" >> "$SUMMARY_FILE"

# =============================================================================
# Test Results
# =============================================================================
if [ -f "$WDIO_RESULTS" ]; then
  TESTS=$(grep -oE 'tests="[0-9]+"' "$WDIO_RESULTS" | head -1 | grep -oE '[0-9]+' || echo "0")
  FAILURES=$(grep -oE 'failures="[0-9]+"' "$WDIO_RESULTS" | head -1 | grep -oE '[0-9]+' || echo "0")
  ERRORS=$(grep -oE 'errors="[0-9]+"' "$WDIO_RESULTS" | head -1 | grep -oE '[0-9]+' || echo "0")
  TIME=$(grep -oE 'time="[0-9.]+"' "$WDIO_RESULTS" | head -1 | grep -oE '[0-9.]+' || echo "")

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
# Screenshots
# =============================================================================
echo "### 测试截图" >> "$SUMMARY_FILE"
echo "" >> "$SUMMARY_FILE"

if [ -d "$SCREENSHOTS_DIR" ]; then
  # macOS find doesn't support -printf, use different approach
  SCREENSHOTS=()
  while IFS= read -r -d '' file; do
    SCREENSHOTS+=("$file")
  done < <(find "$SCREENSHOTS_DIR" -name "*.png" -type f -print0 2>/dev/null | sort -z)
else
  SCREENSHOTS=()
fi

if [ ${#SCREENSHOTS[@]} -eq 0 ]; then
  echo "_无截图_" >> "$SUMMARY_FILE"
  exit 0
fi

# Check if we can upload
if [ -z "${GITHUB_REPOSITORY:-}" ] || [ -z "${GITHUB_RUN_ID:-}" ] || [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "_截图在 artifacts 中_" >> "$SUMMARY_FILE"
  exit 0
fi

# Compress images with sips (macOS native tool)
TEMP_DIR=$(mktemp -d)
trap "rm -rf '$TEMP_DIR'" EXIT

UPLOAD_FILES=()
for img in "${SCREENSHOTS[@]}"; do
  name=$(basename "$img")
  cp "$img" "$TEMP_DIR/$name"
  # Use sips for compression on macOS
  sips -Z 600 "$TEMP_DIR/$name" >/dev/null 2>&1 || true
  UPLOAD_FILES+=("$TEMP_DIR/$name")
done

# Upload screenshots
UPLOAD_DIR="macos/${GITHUB_RUN_ID}"
if upload_to_ci_assets_with_retry "$UPLOAD_DIR" "${UPLOAD_FILES[@]}"; then
  echo "| 步骤 | 截图 | 说明 |" >> "$SUMMARY_FILE"
  echo "|:----:|:----:|:-----|" >> "$SUMMARY_FILE"

  for ((i=0; i<${#UPLOADED_URLS[@]}; i++)); do
    url="${UPLOADED_URLS[$i]}"
    name=$(basename "$url")
    desc=$(get_screenshot_desc "$name")
    echo "| $((i+1)) | ![${desc}](${url}) | ${desc} |" >> "$SUMMARY_FILE"
  done

  echo "" >> "$SUMMARY_FILE"
  echo "_共 ${#UPLOADED_URLS[@]} 张截图_" >> "$SUMMARY_FILE"
else
  echo "_上传失败，截图在 artifacts 中_" >> "$SUMMARY_FILE"
fi
