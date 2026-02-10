#!/bin/bash
# Get session context for AI agents
#
# Usage:
#   ./.viben/scripts/get-context.sh        # Human-readable output
#   ./.viben/scripts/get-context.sh --json # JSON output

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common/paths.sh"
source "$SCRIPT_DIR/common/developer.sh"
source "$SCRIPT_DIR/common/git-context.sh"
source "$SCRIPT_DIR/common/task-queue.sh"

REPO_ROOT=$(get_repo_root)
JSON_OUTPUT=false

[[ "$1" == "--json" ]] && JSON_OUTPUT=true

# Gather context
developer=$(get_developer "$REPO_ROOT")
developer_workspace=$(get_developer_workspace "$REPO_ROOT")
current_task=$(get_current_task "$REPO_ROOT")
current_journal=$(get_current_journal "$REPO_ROOT")
git_branch=$(get_git_branch)
git_status=$(get_git_status_summary)

if [[ "$JSON_OUTPUT" == "true" ]]; then
  # JSON output
  cat << EOF
{
  "developer": "$developer",
  "workspace": "$developer_workspace",
  "current_task": "$current_task",
  "current_journal": "$current_journal",
  "git": {
    "branch": "$git_branch",
    "status": "$git_status"
  }
}
EOF
else
  # Human-readable output
  echo "=== Viben Session Context ==="
  echo ""

  echo "[Developer]"
  if [[ -n "$developer" ]]; then
    echo "  Name: $developer"
    echo "  Workspace: $developer_workspace"
    echo "  Journal: $current_journal"
  else
    echo "  Not initialized. Run: ./.viben/scripts/init-developer.sh <name>"
  fi
  echo ""

  echo "[Current Task]"
  if [[ -n "$current_task" ]]; then
    echo "  Path: $current_task"
    local task_json="$REPO_ROOT/$current_task/$FILE_TASK_JSON"
    if [[ -f "$task_json" ]] && command -v jq &> /dev/null; then
      echo "  Title: $(jq -r '.title // "?"' "$task_json")"
      echo "  Status: $(jq -r '.status // "?"' "$task_json")"
    fi
  else
    echo "  None set"
  fi
  echo ""

  echo "[Git]"
  echo "  Branch: $git_branch"
  echo "  Status: $git_status"
  echo ""

  echo "[Active Tasks]"
  "$SCRIPT_DIR/task.sh" list 2>/dev/null | grep -E "^\s+-" | head -5 || echo "  (none)"
  echo ""

  echo "[Quick Commands]"
  echo "  ./.viben/scripts/task.sh list           # List all tasks"
  echo "  ./.viben/scripts/task.sh create \"...\"   # Create task"
  echo "  ./.viben/scripts/add-session.sh ...     # Record session"
fi
