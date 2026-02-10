#!/bin/bash
# Developer management utilities for Viben workflow
#
# Source this file after paths.sh

# =============================================================================
# Developer Functions
# =============================================================================

# Initialize developer identity
init_developer() {
  local name="$1"
  local repo_root="${2:-$(get_repo_root)}"

  if [[ -z "$name" ]]; then
    echo "Error: Developer name is required" >&2
    return 1
  fi

  # Validate name format (lowercase alphanumeric with hyphens)
  if ! [[ "$name" =~ ^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$ ]]; then
    echo "Error: Invalid developer name. Use lowercase letters, numbers, and hyphens." >&2
    return 1
  fi

  local workflow_dir=$(get_workflow_dir "$repo_root")
  local workspace_dir=$(get_workspace_dir "$repo_root")
  local developer_dir="$workspace_dir/$name"

  # Create developer file
  echo "$name" > "$workflow_dir/$FILE_DEVELOPER"

  # Create developer workspace directory
  mkdir -p "$developer_dir"

  # Create developer index.md if not exists
  if [[ ! -f "$developer_dir/index.md" ]]; then
    local today=$(date +%Y-%m-%d)
    cat > "$developer_dir/index.md" << EOF
# $name Workspace

> Personal workspace for AI Agent sessions

---

## Quick Stats

<!-- @@@auto:stats -->
| Metric | Value |
|--------|-------|
| Total Sessions | 0 |
| Last Active | $today |
| Current Journal | journal-1.md |
<!-- @@@/auto:stats -->

---

## Session History

<!-- @@@auto:history -->
| # | Date | Title | Commits |
|---|------|-------|---------|
<!-- @@@/auto:history -->

---

## Active Work

(None currently)

---

## Notes

(Add any personal notes here)
EOF
  fi

  # Create initial journal file if not exists
  if [[ ! -f "$developer_dir/journal-1.md" ]]; then
    local today=$(date +%Y-%m-%d)
    cat > "$developer_dir/journal-1.md" << EOF
# Journal 1

> Session records for $name

---

## Session 1: Workspace Initialized

**Date**: $today

### Summary

Initialized Viben Agent Organization workspace.

### Status

[OK] **Completed**
EOF
  fi

  echo "Developer initialized: $name"
  echo "Workspace created: $developer_dir"
}

# Get developer workspace directory
get_developer_workspace() {
  local repo_root="${1:-$(get_repo_root)}"
  local developer=$(get_developer "$repo_root")

  if [[ -z "$developer" ]]; then
    return 1
  fi

  echo "$(get_workspace_dir "$repo_root")/$developer"
}

# Get current journal file path
get_current_journal() {
  local repo_root="${1:-$(get_repo_root)}"
  local developer_dir=$(get_developer_workspace "$repo_root")

  if [[ -z "$developer_dir" ]]; then
    return 1
  fi

  # Find highest numbered journal file
  local latest=$(ls -1 "$developer_dir"/journal-*.md 2>/dev/null | sort -t'-' -k2 -n | tail -1)

  if [[ -z "$latest" ]]; then
    echo "$developer_dir/journal-1.md"
  else
    echo "$latest"
  fi
}

# Check if journal needs rotation (2000 line limit)
needs_journal_rotation() {
  local journal_file="$1"

  if [[ ! -f "$journal_file" ]]; then
    return 1  # false, doesn't need rotation
  fi

  local lines=$(wc -l < "$journal_file")
  [[ "$lines" -ge 2000 ]]
}

# Create next journal file
create_next_journal() {
  local repo_root="${1:-$(get_repo_root)}"
  local developer_dir=$(get_developer_workspace "$repo_root")
  local developer=$(get_developer "$repo_root")

  if [[ -z "$developer_dir" ]]; then
    return 1
  fi

  # Find current journal number
  local current=$(ls -1 "$developer_dir"/journal-*.md 2>/dev/null | sort -t'-' -k2 -n | tail -1)
  local next_num=1

  if [[ -n "$current" ]]; then
    local current_num=$(basename "$current" .md | sed 's/journal-//')
    next_num=$((current_num + 1))
  fi

  local next_file="$developer_dir/journal-$next_num.md"
  local today=$(date +%Y-%m-%d)

  cat > "$next_file" << EOF
# Journal $next_num

> Session records for $developer

---

EOF

  echo "$next_file"
}
