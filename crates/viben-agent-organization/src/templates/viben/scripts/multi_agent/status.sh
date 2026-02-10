#!/bin/bash
# Show multi-agent pipeline status
#
# Usage:
#   ./.viben/scripts/multi-agent/status.sh              # Overview
#   ./.viben/scripts/multi-agent/status.sh --log <name> # View agent log

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../common/paths.sh"
source "$SCRIPT_DIR/../common/registry.sh"

REPO_ROOT=$(get_repo_root)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

show_log() {
  local task_name="$1"
  local log_file="$REPO_ROOT/$DIR_WORKFLOW/agents/${task_name}.log"

  if [[ -f "$log_file" ]]; then
    tail -50 "$log_file"
  else
    echo "No log file found for: $task_name"
  fi
}

show_overview() {
  echo -e "${BLUE}=== Multi-Agent Pipeline Status ===${NC}"
  echo ""

  # Show worktrees
  echo -e "${CYAN}[Git Worktrees]${NC}"
  git worktree list | while read -r line; do
    local path=$(echo "$line" | awk '{print $1}')
    local branch=$(echo "$line" | awk '{print $3}' | tr -d '[]')

    if [[ "$path" == "$REPO_ROOT" ]]; then
      echo -e "  ${GREEN}*${NC} $path [$branch] (main)"
    else
      echo "  - $path [$branch]"
    fi
  done
  echo ""

  # Show registered agents
  echo -e "${CYAN}[Registered Agents]${NC}"
  local agents=$(list_agents "$REPO_ROOT")
  if [[ -n "$agents" ]]; then
    echo "$agents" | while IFS=$'\t' read -r name status pid; do
      local status_color="$NC"
      case "$status" in
        running) status_color="$GREEN" ;;
        completed) status_color="$BLUE" ;;
        error) status_color="$RED" ;;
      esac
      echo -e "  - $name [${status_color}$status${NC}] (PID: $pid)"
    done
  else
    echo "  (no agents registered)"
  fi
  echo ""

  # Show limits
  local max_agents=$(grep "max_agents:" "$REPO_ROOT/$DIR_WORKFLOW/worktree.yaml" 2>/dev/null | awk '{print $2}' || echo "5")
  local running=$(count_running_agents "$REPO_ROOT")
  echo -e "${CYAN}[Limits]${NC}"
  echo "  Running: $running / $max_agents"
  echo ""

  echo -e "${CYAN}[Commands]${NC}"
  echo "  status.sh --log <name>    # View agent log"
  echo "  cleanup.sh <branch>       # Remove worktree"
}

# Parse arguments
case "${1:-}" in
  --log|-l)
    show_log "$2"
    ;;
  --watch|-w)
    while true; do
      clear
      show_overview
      sleep 5
    done
    ;;
  *)
    show_overview
    ;;
esac
