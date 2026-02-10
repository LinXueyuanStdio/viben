#!/bin/bash
# Cleanup worktree and agent registry
#
# Usage:
#   ./.viben/scripts/multi-agent/cleanup.sh <branch-or-task>

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../common/paths.sh"
source "$SCRIPT_DIR/../common/worktree.sh"
source "$SCRIPT_DIR/../common/registry.sh"

REPO_ROOT=$(get_repo_root)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [[ -z "$1" ]]; then
  echo -e "${RED}Error: Branch or task name required${NC}"
  echo "Usage: $0 <branch-or-task>"
  echo ""
  echo "Examples:"
  echo "  $0 task/my-feature     # Cleanup by branch"
  echo "  $0 my-task             # Cleanup by task name"
  exit 1
fi

TARGET="$1"

echo -e "${YELLOW}Cleaning up: $TARGET${NC}"

# Try to find worktree by branch or path
worktree_info=$(git worktree list | grep -E "$TARGET" | head -1)

if [[ -n "$worktree_info" ]]; then
  worktree_path=$(echo "$worktree_info" | awk '{print $1}')

  if [[ -n "$worktree_path" ]] && [[ "$worktree_path" != "$REPO_ROOT" ]]; then
    echo "Removing worktree: $worktree_path"
    git worktree remove "$worktree_path" --force 2>/dev/null || true
  fi
fi

# Unregister from agent registry
unregister_agent "$TARGET" "$REPO_ROOT"

# Prune worktrees
git worktree prune

echo -e "${GREEN}Cleanup complete${NC}"
