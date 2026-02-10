#!/bin/bash
# Git worktree utilities for multi-agent development
#
# Source this file after paths.sh

# =============================================================================
# Worktree Functions
# =============================================================================

# Get worktree base directory from worktree.yaml
get_worktree_base() {
  local repo_root="${1:-$(get_repo_root)}"
  local repo_name=$(basename "$repo_root")
  local config_file="$repo_root/$DIR_WORKFLOW/worktree.yaml"

  if [[ -f "$config_file" ]]; then
    local base=$(grep "worktree_base:" "$config_file" | sed 's/.*worktree_base:[[:space:]]*"\(.*\)"/\1/' | sed "s/{repo-name}/$repo_name/")
    if [[ -n "$base" ]]; then
      echo "$base"
      return
    fi
  fi

  # Default fallback
  echo "../${repo_name}-worktrees"
}

# Create a new worktree for a task
create_worktree() {
  local branch="$1"
  local task_name="$2"
  local repo_root="${3:-$(get_repo_root)}"

  if [[ -z "$branch" ]] || [[ -z "$task_name" ]]; then
    echo "Error: branch and task_name required" >&2
    return 1
  fi

  local worktree_base=$(get_worktree_base "$repo_root")
  local worktree_path="$repo_root/$worktree_base/$task_name"

  # Create branch if it doesn't exist
  if ! git show-ref --verify --quiet "refs/heads/$branch"; then
    git branch "$branch"
  fi

  # Create worktree
  git worktree add "$worktree_path" "$branch" 2>/dev/null

  echo "$worktree_path"
}

# Remove a worktree
remove_worktree() {
  local worktree_path="$1"

  if [[ -z "$worktree_path" ]]; then
    echo "Error: worktree_path required" >&2
    return 1
  fi

  git worktree remove "$worktree_path" --force 2>/dev/null
}

# List all worktrees
list_worktrees() {
  git worktree list
}

# Check if worktree exists
worktree_exists() {
  local worktree_path="$1"
  git worktree list | grep -q "$worktree_path"
}

# Get worktree branch
get_worktree_branch() {
  local worktree_path="$1"
  git -C "$worktree_path" branch --show-current 2>/dev/null
}
