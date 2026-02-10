#!/bin/bash
# Git context utilities for Viben workflow
#
# Source this file after paths.sh

# =============================================================================
# Git Context Functions
# =============================================================================

# Get current git branch
get_git_branch() {
  git branch --show-current 2>/dev/null || echo "unknown"
}

# Get git status summary
get_git_status_summary() {
  local staged=$(git diff --cached --numstat 2>/dev/null | wc -l | tr -d ' ')
  local unstaged=$(git diff --numstat 2>/dev/null | wc -l | tr -d ' ')
  local untracked=$(git ls-files --others --exclude-standard 2>/dev/null | wc -l | tr -d ' ')

  echo "staged:$staged,unstaged:$unstaged,untracked:$untracked"
}

# Get recent commits (default 5)
get_recent_commits() {
  local count="${1:-5}"
  git log --oneline -n "$count" 2>/dev/null
}

# Check if working directory is clean
is_working_dir_clean() {
  git diff --quiet 2>/dev/null && git diff --cached --quiet 2>/dev/null
}

# Get the remote tracking branch
get_remote_tracking_branch() {
  git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null
}

# Check if branch is ahead/behind remote
get_branch_status() {
  local ahead=$(git rev-list --count @{u}..HEAD 2>/dev/null || echo "0")
  local behind=$(git rev-list --count HEAD..@{u} 2>/dev/null || echo "0")

  if [[ "$ahead" -gt 0 ]] && [[ "$behind" -gt 0 ]]; then
    echo "diverged (ahead $ahead, behind $behind)"
  elif [[ "$ahead" -gt 0 ]]; then
    echo "ahead $ahead"
  elif [[ "$behind" -gt 0 ]]; then
    echo "behind $behind"
  else
    echo "up to date"
  fi
}

# Print full git context
print_git_context() {
  echo "=== Git Context ==="
  echo "Branch: $(get_git_branch)"
  echo "Status: $(get_git_status_summary)"
  echo "Remote: $(get_branch_status)"
  echo ""
  echo "Recent commits:"
  get_recent_commits 5 | sed 's/^/  /'
  echo ""
}

# Get git context as JSON
get_git_context_json() {
  local branch=$(get_git_branch)
  local status=$(get_git_status_summary)
  local remote_status=$(get_branch_status)

  cat << EOF
{
  "branch": "$branch",
  "status": "$status",
  "remote_status": "$remote_status"
}
EOF
}
