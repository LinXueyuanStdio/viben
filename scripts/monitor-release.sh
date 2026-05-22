#!/bin/bash
# Monitor release workflow - waits until completion or failure
#
# Usage: ./scripts/monitor-release.sh <run-id>
#
# This script polls the workflow status and waits until it completes.
# It adjusts polling interval based on the current phase.
#
# Exit codes:
#   0 - Workflow completed successfully
#   1 - Workflow failed or was cancelled

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

RUN_ID="$1"

if [[ -z "$RUN_ID" ]]; then
  echo -e "${RED}Error: Run ID is required${NC}"
  echo "Usage: ./scripts/monitor-release.sh <run-id>"
  exit 1
fi

# Workflow timeline estimates (in seconds)
# Based on analysis of successful runs:
#   prepare: ~10s
#   build-cli: ~8min (parallel)
#   test-cli: ~2min (parallel)
#   release-cli: ~1min
#   build-desktop: ~20min (parallel)
#   create-release: ~1min
#   Total: ~30-35min

get_wait_time() {
  local phase="$1"
  local elapsed_minutes="$2"

  case "$phase" in
    "prepare")
      echo 30
      ;;
    "build-cli")
      echo 180  # 3 minutes
      ;;
    "test-cli")
      echo 90   # 1.5 minutes
      ;;
    "release-cli"|"update-homebrew")
      echo 60
      ;;
    "build-desktop")
      # Desktop build is longest, adjust based on elapsed time
      if [[ $elapsed_minutes -lt 20 ]]; then
        echo 300  # 5 minutes early on
      else
        echo 120  # 2 minutes near the end
      fi
      ;;
    "create-release")
      echo 60
      ;;
    *)
      echo 120  # Default 2 minutes
      ;;
  esac
}

print_status() {
  local run_info="$1"
  local elapsed_minutes="$2"

  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  Release Workflow Monitor${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo -e "Run ID: ${CYAN}$RUN_ID${NC}"
  echo -e "Elapsed: ${elapsed_minutes} minutes"
  echo ""
  echo -e "${YELLOW}Jobs:${NC}"

  # Parse and display job status
  echo "$run_info" | jq -r '.jobs[] | "\(.name)|\(.status)|\(.conclusion)"' | while IFS='|' read -r name status conclusion; do
    # Truncate long job names
    short_name=$(echo "$name" | cut -c1-55)
    if [[ ${#name} -gt 55 ]]; then
      short_name="${short_name}..."
    fi

    if [[ "$status" == "completed" ]]; then
      if [[ "$conclusion" == "success" ]]; then
        printf "  ${GREEN}✓${NC} %-60s\n" "$short_name"
      elif [[ "$conclusion" == "failure" ]]; then
        printf "  ${RED}✗${NC} %-60s\n" "$short_name"
      elif [[ "$conclusion" == "skipped" ]]; then
        printf "  ${YELLOW}○${NC} %-60s ${YELLOW}(skipped)${NC}\n" "$short_name"
      else
        printf "  ${YELLOW}?${NC} %-60s ${YELLOW}(%s)${NC}\n" "$short_name" "$conclusion"
      fi
    elif [[ "$status" == "in_progress" ]]; then
      printf "  ${CYAN}▶${NC} %-60s ${CYAN}(running)${NC}\n" "$short_name"
    elif [[ "$status" == "queued" ]]; then
      printf "  ${YELLOW}◷${NC} %-60s ${YELLOW}(queued)${NC}\n" "$short_name"
    else
      printf "  ${YELLOW}…${NC} %-60s ${YELLOW}(%s)${NC}\n" "$short_name" "$status"
    fi
  done
}

detect_phase() {
  local run_info="$1"

  if echo "$run_info" | jq -e '.jobs[] | select(.name == "prepare" and .status == "in_progress")' > /dev/null 2>&1; then
    echo "prepare"
  elif echo "$run_info" | jq -e '.jobs[] | select(.name | startswith("build-cli")) | select(.status == "in_progress")' > /dev/null 2>&1; then
    echo "build-cli"
  elif echo "$run_info" | jq -e '.jobs[] | select(.name | startswith("test-cli")) | select(.status == "in_progress")' > /dev/null 2>&1; then
    echo "test-cli"
  elif echo "$run_info" | jq -e '.jobs[] | select(.name == "release-cli" and .status == "in_progress")' > /dev/null 2>&1; then
    echo "release-cli"
  elif echo "$run_info" | jq -e '.jobs[] | select(.name == "update-homebrew" and .status == "in_progress")' > /dev/null 2>&1; then
    echo "update-homebrew"
  elif echo "$run_info" | jq -e '.jobs[] | select(.name | startswith("build-desktop")) | select(.status == "in_progress")' > /dev/null 2>&1; then
    echo "build-desktop"
  elif echo "$run_info" | jq -e '.jobs[] | select(.name == "create-unified-release" and .status == "in_progress")' > /dev/null 2>&1; then
    echo "create-release"
  else
    echo "unknown"
  fi
}

echo -e "${BLUE}Starting release workflow monitor for run ${CYAN}$RUN_ID${NC}"
echo -e "URL: https://github.com/LinXueyuanStdio/viben/actions/runs/$RUN_ID"
echo ""
echo -e "${YELLOW}Expected timeline:${NC}"
echo "  prepare       ~10s"
echo "  build-cli     ~8min"
echo "  test-cli      ~2min"
echo "  release-cli   ~1min"
echo "  build-desktop ~20min"
echo "  create-release ~1min"
echo "  ────────────────────"
echo "  Total         ~30-35min"
echo ""

START_TIME=$(date +%s)
CHECK_COUNT=0

while true; do
  CHECK_COUNT=$((CHECK_COUNT + 1))

  # Get workflow run status
  RUN_INFO=$(gh run view "$RUN_ID" --json status,conclusion,jobs,createdAt,updatedAt,url 2>&1) || {
    echo -e "${RED}Error fetching workflow status: $RUN_INFO${NC}"
    sleep 30
    continue
  }

  STATUS=$(echo "$RUN_INFO" | jq -r '.status')
  CONCLUSION=$(echo "$RUN_INFO" | jq -r '.conclusion')

  # Calculate elapsed time
  NOW=$(date +%s)
  ELAPSED_SECONDS=$((NOW - START_TIME))
  ELAPSED_MINUTES=$((ELAPSED_SECONDS / 60))

  # Print current status
  print_status "$RUN_INFO" "$ELAPSED_MINUTES"

  # Check if completed
  if [[ "$STATUS" == "completed" ]]; then
    echo ""

    if [[ "$CONCLUSION" == "success" ]]; then
      echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
      echo -e "${GREEN}  ✓ Release completed successfully!${NC}"
      echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
      echo ""
      echo "Total time: ${ELAPSED_MINUTES} minutes"
      echo ""
      echo "Check the release at:"
      echo "  https://github.com/LinXueyuanStdio/viben/releases"
      echo ""
      exit 0

    elif [[ "$CONCLUSION" == "failure" ]]; then
      echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
      echo -e "${RED}  ✗ Release workflow FAILED${NC}"
      echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
      echo ""

      # Find and display failed jobs
      echo -e "${YELLOW}Failed jobs:${NC}"
      FAILED_JOBS=$(echo "$RUN_INFO" | jq -r '.jobs[] | select(.conclusion == "failure") | .name')
      echo "$FAILED_JOBS" | while read -r job_name; do
        echo "  - $job_name"
      done
      echo ""

      # Get error logs
      echo -e "${YELLOW}Error details:${NC}"
      echo "────────────────────────────────────────"
      gh run view "$RUN_ID" --log-failed 2>&1 | tail -50
      echo "────────────────────────────────────────"
      echo ""

      echo "To view full logs:"
      echo "  gh run view $RUN_ID --log-failed"
      echo ""
      echo "To rerun failed jobs:"
      echo "  gh run rerun $RUN_ID --failed"
      echo ""
      exit 1

    elif [[ "$CONCLUSION" == "cancelled" ]]; then
      echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
      echo -e "${YELLOW}  ○ Release workflow was cancelled${NC}"
      echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
      echo ""
      exit 1
    fi
  fi

  # Still in progress - determine wait time based on phase
  CURRENT_PHASE=$(detect_phase "$RUN_INFO")
  WAIT_TIME=$(get_wait_time "$CURRENT_PHASE" "$ELAPSED_MINUTES")

  COMPLETED_JOBS=$(echo "$RUN_INFO" | jq -r '[.jobs[] | select(.status == "completed")] | length')
  TOTAL_JOBS=$(echo "$RUN_INFO" | jq -r '.jobs | length')

  echo ""
  echo -e "Progress: ${CYAN}$COMPLETED_JOBS/$TOTAL_JOBS${NC} jobs | Phase: ${CYAN}$CURRENT_PHASE${NC}"
  echo -e "Next check in ${WAIT_TIME}s (check #$CHECK_COUNT)"

  sleep "$WAIT_TIME"
done
