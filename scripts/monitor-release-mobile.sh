#!/bin/bash
# Monitor mobile release workflow and report results
#
# Usage: ./scripts/monitor-release-mobile.sh [run-id]
# If run-id is not provided, monitors the most recent release-mobile.yml run

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get run ID from argument or find the most recent run
RUN_ID="${1:-}"

if [[ -z "$RUN_ID" ]]; then
  echo -e "${BLUE}Finding most recent release-mobile.yml run...${NC}"
  RUN_ID=$(gh run list --workflow=release-mobile.yml --limit=1 --json databaseId --jq '.[0].databaseId')

  if [[ -z "$RUN_ID" ]]; then
    echo -e "${RED}Error: No release-mobile.yml runs found${NC}"
    exit 1
  fi
fi

echo -e "${CYAN}Monitoring workflow run: ${RUN_ID}${NC}"
echo -e "${CYAN}URL: https://github.com/LinXueyuanStdio/viben/actions/runs/${RUN_ID}${NC}"
echo ""

# Function to get job status with color
get_status_color() {
  local status="$1"
  local conclusion="$2"

  if [[ "$status" == "completed" ]]; then
    case "$conclusion" in
      success) echo -e "${GREEN}✓ success${NC}" ;;
      failure) echo -e "${RED}✗ failure${NC}" ;;
      skipped) echo -e "${YELLOW}⊘ skipped${NC}" ;;
      *) echo -e "${YELLOW}? $conclusion${NC}" ;;
    esac
  elif [[ "$status" == "in_progress" ]]; then
    echo -e "${BLUE}⟳ running${NC}"
  elif [[ "$status" == "queued" ]]; then
    echo -e "${CYAN}◯ queued${NC}"
  else
    echo -e "${YELLOW}? $status${NC}"
  fi
}

# Poll interval in seconds
POLL_INTERVAL=30
MAX_WAIT=3600  # 1 hour max wait
ELAPSED=0

while true; do
  # Get workflow status
  WORKFLOW_JSON=$(gh run view "$RUN_ID" --json status,conclusion,jobs)
  WORKFLOW_STATUS=$(echo "$WORKFLOW_JSON" | jq -r '.status')
  WORKFLOW_CONCLUSION=$(echo "$WORKFLOW_JSON" | jq -r '.conclusion')

  # Show status header
  echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}  Mobile Release Workflow Monitor${NC}"
  echo -e "${CYAN}  Run ID: ${RUN_ID}${NC}"
  echo -e "${CYAN}  Elapsed: $((ELAPSED / 60))m $((ELAPSED % 60))s${NC}"
  echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
  echo ""

  # Show job statuses
  echo -e "${BLUE}Job Status:${NC}"
  echo ""

  # Define job order for display
  JOBS=(
    "prepare"
    "build-android"
    "build-ios"
    "test-android"
    "test-ios"
    "release-android"
    "release-ios"
    "checksums"
  )

  for JOB_NAME in "${JOBS[@]}"; do
    JOB_INFO=$(echo "$WORKFLOW_JSON" | jq -r --arg name "$JOB_NAME" '.jobs[] | select(.name == $name) | "\(.status)|\(.conclusion)"')
    if [[ -n "$JOB_INFO" ]]; then
      JOB_STATUS=$(echo "$JOB_INFO" | cut -d'|' -f1)
      JOB_CONCLUSION=$(echo "$JOB_INFO" | cut -d'|' -f2)
      STATUS_STR=$(get_status_color "$JOB_STATUS" "$JOB_CONCLUSION")
      printf "  %-20s %s\n" "$JOB_NAME" "$STATUS_STR"
    fi
  done

  echo ""

  # Check if workflow is complete
  if [[ "$WORKFLOW_STATUS" == "completed" ]]; then
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"

    if [[ "$WORKFLOW_CONCLUSION" == "success" ]]; then
      echo -e "${GREEN}✓ Workflow completed successfully!${NC}"
      echo ""

      # Get release info
      echo -e "${BLUE}Release artifacts:${NC}"
      gh release list --limit 2

      exit 0
    else
      echo -e "${RED}✗ Workflow failed with conclusion: $WORKFLOW_CONCLUSION${NC}"
      echo ""

      # Show failed jobs
      echo -e "${RED}Failed jobs:${NC}"
      echo "$WORKFLOW_JSON" | jq -r '.jobs[] | select(.conclusion == "failure") | "  - \(.name)"'
      echo ""

      # Show error summary
      echo -e "${YELLOW}Check the workflow logs for details:${NC}"
      echo "  https://github.com/LinXueyuanStdio/viben/actions/runs/${RUN_ID}"

      exit 1
    fi
  fi

  # Check timeout
  if [[ $ELAPSED -ge $MAX_WAIT ]]; then
    echo -e "${RED}Error: Timeout waiting for workflow to complete${NC}"
    exit 1
  fi

  # Wait before next poll
  sleep $POLL_INTERVAL
  ELAPSED=$((ELAPSED + POLL_INTERVAL))
done
