#!/bin/bash
# Start multi-agent pipeline for a task
#
# Usage:
#   ./.viben/scripts/multi-agent/start.sh <task-dir>

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../common/paths.sh"
source "$SCRIPT_DIR/../common/worktree.sh"
source "$SCRIPT_DIR/../common/registry.sh"
source "$SCRIPT_DIR/../common/task-queue.sh"

REPO_ROOT=$(get_repo_root)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

if [[ -z "$1" ]]; then
  echo -e "${RED}Error: Task directory required${NC}"
  echo "Usage: $0 <task-dir>"
  exit 1
fi

TASK_DIR="$1"
[[ ! "$TASK_DIR" = /* ]] && TASK_DIR="$REPO_ROOT/$TASK_DIR"

if [[ ! -d "$TASK_DIR" ]]; then
  echo -e "${RED}Error: Task directory not found: $TASK_DIR${NC}"
  exit 1
fi

TASK_JSON="$TASK_DIR/$FILE_TASK_JSON"
if [[ ! -f "$TASK_JSON" ]]; then
  echo -e "${RED}Error: task.json not found${NC}"
  exit 1
fi

# Read task config
task_name=$(jq -r '.name' "$TASK_JSON")
branch=$(jq -r '.branch // empty' "$TASK_JSON")

if [[ -z "$branch" ]]; then
  echo -e "${RED}Error: Branch not set. Run: task.sh set-branch <dir> <branch>${NC}"
  exit 1
fi

echo -e "${BLUE}=== Starting Multi-Agent Pipeline ===${NC}"
echo "Task: $task_name"
echo "Branch: $branch"
echo ""

# Check agent limits
max_agents=$(grep "max_agents:" "$REPO_ROOT/$DIR_WORKFLOW/worktree.yaml" 2>/dev/null | awk '{print $2}' || echo "5")
running=$(count_running_agents "$REPO_ROOT")

if [[ "$running" -ge "$max_agents" ]]; then
  echo -e "${RED}Error: Max agents reached ($running/$max_agents)${NC}"
  echo "Run: ./.viben/scripts/multi-agent/status.sh to see running agents"
  exit 1
fi

# Create worktree
echo -e "${YELLOW}Creating worktree...${NC}"
worktree_path=$(create_worktree "$branch" "$task_name" "$REPO_ROOT")

if [[ -z "$worktree_path" ]] || [[ ! -d "$worktree_path" ]]; then
  echo -e "${RED}Error: Failed to create worktree${NC}"
  exit 1
fi

echo -e "${GREEN}Worktree: $worktree_path${NC}"

# Update task.json with worktree path
jq --arg wt "$worktree_path" '.worktree_path = $wt | .status = "in_progress"' "$TASK_JSON" > "${TASK_JSON}.tmp"
mv "${TASK_JSON}.tmp" "$TASK_JSON"

# Copy task directory to worktree
cp -r "$TASK_DIR" "$worktree_path/$DIR_WORKFLOW/$DIR_TASKS/"

echo ""
echo -e "${GREEN}=== Pipeline Ready ===${NC}"
echo ""
echo "Worktree: $worktree_path"
echo "Task: $task_name"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. cd $worktree_path"
echo "  2. Start Claude Code or Cursor in the worktree"
echo "  3. Run: /viben:start"
echo ""
echo "Monitor: ./.viben/scripts/multi-agent/status.sh"
