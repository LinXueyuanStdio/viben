#!/bin/bash
# Monitor release workflow - for use with Claude Code's loop/cron functionality
#
# Usage: ./scripts/monitor-release.sh <run-id>
#
# This script checks the status of a release workflow run and outputs
# structured information that Claude Code can use to determine next actions.
#
# Exit codes:
#   0 - Workflow completed successfully
#   1 - Workflow failed or was cancelled
#   2 - Workflow still in progress (check again later)

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

# Get workflow run status
RUN_INFO=$(gh run view "$RUN_ID" --json status,conclusion,jobs,createdAt,updatedAt,url)

STATUS=$(echo "$RUN_INFO" | jq -r '.status')
CONCLUSION=$(echo "$RUN_INFO" | jq -r '.conclusion')
URL=$(echo "$RUN_INFO" | jq -r '.url')
CREATED_AT=$(echo "$RUN_INFO" | jq -r '.createdAt')

# Calculate elapsed time
CREATED_EPOCH=$(date -d "$CREATED_AT" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%SZ" "$CREATED_AT" +%s 2>/dev/null || echo "0")
NOW_EPOCH=$(date +%s)
ELAPSED_SECONDS=$((NOW_EPOCH - CREATED_EPOCH))
ELAPSED_MINUTES=$((ELAPSED_SECONDS / 60))

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Release Workflow Monitor${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Run ID: ${CYAN}$RUN_ID${NC}"
echo -e "URL: $URL"
echo -e "Elapsed: ${ELAPSED_MINUTES}min ${ELAPSED_SECONDS}s"
echo ""

# Job status summary
echo -e "${YELLOW}Job Status:${NC}"
echo ""

# Parse jobs and display status
echo "$RUN_INFO" | jq -r '.jobs[] | "\(.name)|\(.status)|\(.conclusion)"' | while IFS='|' read -r name status conclusion; do
  # Truncate long job names
  short_name=$(echo "$name" | cut -c1-50)
  if [[ ${#name} -gt 50 ]]; then
    short_name="${short_name}..."
  fi

  if [[ "$status" == "completed" ]]; then
    if [[ "$conclusion" == "success" ]]; then
      echo -e "  ${GREEN}✓${NC} $short_name"
    elif [[ "$conclusion" == "failure" ]]; then
      echo -e "  ${RED}✗${NC} $short_name"
    elif [[ "$conclusion" == "skipped" ]]; then
      echo -e "  ${YELLOW}○${NC} $short_name (skipped)"
    else
      echo -e "  ${YELLOW}?${NC} $short_name ($conclusion)"
    fi
  elif [[ "$status" == "in_progress" ]]; then
    echo -e "  ${CYAN}▶${NC} $short_name (running)"
  elif [[ "$status" == "queued" ]]; then
    echo -e "  ${YELLOW}◷${NC} $short_name (queued)"
  else
    echo -e "  ${YELLOW}…${NC} $short_name ($status)"
  fi
done

echo ""

# Determine overall status and next action
if [[ "$STATUS" == "completed" ]]; then
  if [[ "$CONCLUSION" == "success" ]]; then
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  ✓ Release completed successfully!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo "Check the release at:"
    echo "  https://github.com/LinXueyuanStdio/viben/releases"
    echo ""
    echo "MONITOR_STATUS=success"
    exit 0
  elif [[ "$CONCLUSION" == "failure" ]]; then
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}  ✗ Release workflow failed${NC}"
    echo -e "${RED}========================================${NC}"
    echo ""

    # Find failed jobs
    echo -e "${YELLOW}Failed jobs:${NC}"
    echo "$RUN_INFO" | jq -r '.jobs[] | select(.conclusion == "failure") | .name' | while read -r job_name; do
      echo "  - $job_name"
    done
    echo ""

    echo "To view failed job logs:"
    echo "  gh run view $RUN_ID --log-failed"
    echo ""
    echo "To rerun failed jobs:"
    echo "  gh run rerun $RUN_ID --failed"
    echo ""
    echo "MONITOR_STATUS=failure"
    exit 1
  elif [[ "$CONCLUSION" == "cancelled" ]]; then
    echo -e "${YELLOW}========================================${NC}"
    echo -e "${YELLOW}  ○ Release workflow was cancelled${NC}"
    echo -e "${YELLOW}========================================${NC}"
    echo ""
    echo "MONITOR_STATUS=cancelled"
    exit 1
  fi
elif [[ "$STATUS" == "in_progress" ]] || [[ "$STATUS" == "queued" ]]; then
  # Determine which phase we're in and suggest next check time
  RUNNING_JOBS=$(echo "$RUN_INFO" | jq -r '[.jobs[] | select(.status == "in_progress")] | length')
  COMPLETED_JOBS=$(echo "$RUN_INFO" | jq -r '[.jobs[] | select(.status == "completed")] | length')
  TOTAL_JOBS=$(echo "$RUN_INFO" | jq -r '.jobs | length')

  # Check what's currently running
  CURRENT_PHASE=""
  SUGGESTED_WAIT=60

  if echo "$RUN_INFO" | jq -e '.jobs[] | select(.name == "prepare" and .status == "in_progress")' > /dev/null 2>&1; then
    CURRENT_PHASE="prepare"
    SUGGESTED_WAIT=30
  elif echo "$RUN_INFO" | jq -e '.jobs[] | select(.name | startswith("build-cli")) | select(.status == "in_progress")' > /dev/null 2>&1; then
    CURRENT_PHASE="build-cli"
    SUGGESTED_WAIT=180  # 3 minutes
  elif echo "$RUN_INFO" | jq -e '.jobs[] | select(.name | startswith("test-cli")) | select(.status == "in_progress")' > /dev/null 2>&1; then
    CURRENT_PHASE="test-cli"
    SUGGESTED_WAIT=90  # 1.5 minutes
  elif echo "$RUN_INFO" | jq -e '.jobs[] | select(.name == "release-cli" and .status == "in_progress")' > /dev/null 2>&1; then
    CURRENT_PHASE="release-cli"
    SUGGESTED_WAIT=60
  elif echo "$RUN_INFO" | jq -e '.jobs[] | select(.name | startswith("build-desktop")) | select(.status == "in_progress")' > /dev/null 2>&1; then
    CURRENT_PHASE="build-desktop"
    # Desktop build is the longest, check less frequently
    if [[ $ELAPSED_MINUTES -lt 15 ]]; then
      SUGGESTED_WAIT=300  # 5 minutes
    else
      SUGGESTED_WAIT=180  # 3 minutes near the end
    fi
  elif echo "$RUN_INFO" | jq -e '.jobs[] | select(.name == "create-unified-release" and .status == "in_progress")' > /dev/null 2>&1; then
    CURRENT_PHASE="create-release"
    SUGGESTED_WAIT=60
  fi

  echo -e "${CYAN}========================================${NC}"
  echo -e "${CYAN}  ▶ Workflow in progress${NC}"
  echo -e "${CYAN}========================================${NC}"
  echo ""
  echo "Progress: $COMPLETED_JOBS/$TOTAL_JOBS jobs completed"
  echo "Running: $RUNNING_JOBS jobs"
  [[ -n "$CURRENT_PHASE" ]] && echo "Current phase: $CURRENT_PHASE"
  echo ""
  echo "MONITOR_STATUS=in_progress"
  echo "MONITOR_PHASE=$CURRENT_PHASE"
  echo "MONITOR_PROGRESS=$COMPLETED_JOBS/$TOTAL_JOBS"
  echo "MONITOR_SUGGESTED_WAIT=${SUGGESTED_WAIT}s"
  echo ""
  echo -e "${YELLOW}Suggested next check: in ${SUGGESTED_WAIT} seconds${NC}"
  exit 2
fi

echo "MONITOR_STATUS=unknown"
exit 1
