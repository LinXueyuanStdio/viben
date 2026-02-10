#!/bin/bash
# Task utility functions for Viben workflow
#
# Source this file after paths.sh and task-queue.sh

# =============================================================================
# Task Utility Functions
# =============================================================================

# Find task by name (searches by suffix match)
find_task_by_name() {
  local task_name="$1"
  local tasks_dir="${2:-$(get_tasks_dir)}"

  # Exact match first
  if [[ -d "$tasks_dir/$task_name" ]]; then
    echo "$tasks_dir/$task_name"
    return
  fi

  # Search by suffix (MM-DD-name pattern)
  for dir in "$tasks_dir"/*-"$task_name"/; do
    if [[ -d "$dir" ]]; then
      echo "${dir%/}"
      return
    fi
  done

  # Not found
  return 1
}

# Archive completed task
archive_task_complete() {
  local task_dir="$1"
  local repo_root="${2:-$(get_repo_root)}"

  if [[ ! -d "$task_dir" ]]; then
    echo "Error: Task directory not found" >&2
    return 1
  fi

  local tasks_dir=$(get_tasks_dir "$repo_root")
  local archive_dir="$tasks_dir/$DIR_ARCHIVE"
  local year_month=$(date +%Y-%m)
  local dest_dir="$archive_dir/$year_month"

  mkdir -p "$dest_dir"

  local task_name=$(basename "$task_dir")
  local final_dest="$dest_dir/$task_name"

  mv "$task_dir" "$final_dest"

  echo "archived_to:$final_dest"
}

# List active tasks (non-archived)
list_active_tasks() {
  local tasks_dir="${1:-$(get_tasks_dir)}"

  for dir in "$tasks_dir"/*/; do
    local name=$(basename "$dir")
    [[ "$name" == "archive" ]] && continue
    [[ -d "$dir" ]] && echo "$name"
  done
}

# Count active tasks
count_active_tasks() {
  local tasks_dir="${1:-$(get_tasks_dir)}"
  list_active_tasks "$tasks_dir" | wc -l | tr -d ' '
}

# Get task title from task.json
get_task_title() {
  local task_dir="$1"
  get_task_field "$task_dir" "title"
}

# Get task assignee
get_task_assignee() {
  local task_dir="$1"
  get_task_field "$task_dir" "assignee"
}

# Check if task belongs to current developer
is_my_task() {
  local task_dir="$1"
  local repo_root="${2:-$(get_repo_root)}"

  local assignee=$(get_task_assignee "$task_dir")
  local developer=$(get_developer "$repo_root")

  [[ "$assignee" == "$developer" ]]
}
