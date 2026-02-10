#!/bin/bash
# Create PR from task
#
# Usage:
#   ./.viben/scripts/multi-agent/create-pr.sh [task-dir] [--dry-run]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../common/paths.sh"
source "$SCRIPT_DIR/../common/task-queue.sh"

REPO_ROOT=$(get_repo_root)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Parse arguments
TARGET_DIR=""
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    *) [[ -z "$TARGET_DIR" ]] && TARGET_DIR="$1"; shift ;;
  esac
done

# Get task directory
if [[ -z "$TARGET_DIR" ]]; then
  TARGET_DIR=$(get_current_task "$REPO_ROOT")
  if [[ -z "$TARGET_DIR" ]]; then
    echo -e "${RED}Error: No task specified and no current task${NC}"
    exit 1
  fi
fi

[[ ! "$TARGET_DIR" = /* ]] && TARGET_DIR="$REPO_ROOT/$TARGET_DIR"

TASK_JSON="$TARGET_DIR/$FILE_TASK_JSON"
if [[ ! -f "$TASK_JSON" ]]; then
  echo -e "${RED}Error: task.json not found${NC}"
  exit 1
fi

echo -e "${BLUE}=== Create PR ===${NC}"
[[ "$DRY_RUN" == "true" ]] && echo -e "${YELLOW}[DRY-RUN MODE]${NC}"
echo ""

# Read task config
task_name=$(jq -r '.name' "$TASK_JSON")
base_branch=$(jq -r '.base_branch // "main"' "$TASK_JSON")
scope=$(jq -r '.scope // "core"' "$TASK_JSON")
dev_type=$(jq -r '.dev_type // "feature"' "$TASK_JSON")
title=$(jq -r '.title // .name' "$TASK_JSON")

# Map dev_type to prefix
case "$dev_type" in
  feature|frontend|backend|fullstack) prefix="feat" ;;
  bugfix|fix) prefix="fix" ;;
  refactor) prefix="refactor" ;;
  docs) prefix="docs" ;;
  *) prefix="feat" ;;
esac

current_branch=$(git branch --show-current)
pr_title="${prefix}(${scope}): ${title}"

echo "Task: $task_name"
echo "Branch: $current_branch -> $base_branch"
echo "Title: $pr_title"
echo ""

# Stage changes
git add -A
git reset "$DIR_WORKFLOW/$DIR_WORKSPACE/" 2>/dev/null || true

if git diff --cached --quiet 2>/dev/null; then
  echo -e "${YELLOW}No staged changes${NC}"

  # Check for unpushed commits
  unpushed=$(git log "origin/${current_branch}..HEAD" --oneline 2>/dev/null | wc -l | tr -d ' ' || echo "0")
  if [[ "$unpushed" -eq 0 ]]; then
    echo -e "${RED}No changes to create PR${NC}"
    exit 1
  fi
  echo "Found $unpushed unpushed commit(s)"
else
  # Commit
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[DRY-RUN] Would commit: $pr_title"
    git diff --cached --name-only | sed 's/^/  /'
    git reset HEAD >/dev/null 2>&1 || true
  else
    git commit -m "$pr_title"
    echo -e "${GREEN}Committed${NC}"
  fi
fi

# Push
if [[ "$DRY_RUN" == "true" ]]; then
  echo "[DRY-RUN] Would push to: origin/$current_branch"
else
  git push -u origin "$current_branch"
  echo -e "${GREEN}Pushed${NC}"
fi

# Create PR
if [[ "$DRY_RUN" == "true" ]]; then
  echo "[DRY-RUN] Would create PR: $pr_title"
  pr_url="https://github.com/example/repo/pull/DRY-RUN"
else
  existing_pr=$(gh pr list --head "$current_branch" --base "$base_branch" --json url --jq '.[0].url' 2>/dev/null || echo "")

  if [[ -n "$existing_pr" ]]; then
    echo -e "${YELLOW}PR exists: $existing_pr${NC}"
    pr_url="$existing_pr"
  else
    pr_body=""
    [[ -f "$TARGET_DIR/prd.md" ]] && pr_body=$(cat "$TARGET_DIR/prd.md")

    pr_url=$(gh pr create --draft --base "$base_branch" --title "$pr_title" --body "$pr_body" 2>&1)
    echo -e "${GREEN}PR created: $pr_url${NC}"
  fi
fi

# Update task.json
if [[ "$DRY_RUN" != "true" ]]; then
  jq --arg url "$pr_url" '.status = "review" | .pr_url = $url' "$TASK_JSON" > "${TASK_JSON}.tmp"
  mv "${TASK_JSON}.tmp" "$TASK_JSON"
fi

echo ""
echo -e "${GREEN}=== Done ===${NC}"
echo "PR: $pr_url"
