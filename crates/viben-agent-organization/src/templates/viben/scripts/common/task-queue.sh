#!/bin/bash
# Task queue utilities for Viben workflow
#
# Source this file after paths.sh

# =============================================================================
# Task Queue Functions
# =============================================================================

# Get task directory from task name or path
resolve_task_dir() {
  local task_ref="$1"
  local repo_root="${2:-$(get_repo_root)}"
  local tasks_dir=$(get_tasks_dir "$repo_root")

  # If already absolute path
  if [[ "$task_ref" = /* ]] && [[ -d "$task_ref" ]]; then
    echo "$task_ref"
    return
  fi

  # If relative path starting with .viben
  if [[ "$task_ref" == "$DIR_WORKFLOW/"* ]] && [[ -d "$repo_root/$task_ref" ]]; then
    echo "$repo_root/$task_ref"
    return
  fi

  # Search by name in tasks directory
  for dir in "$tasks_dir"/*-"$task_ref"/ "$tasks_dir"/"$task_ref"/; do
    if [[ -d "$dir" ]]; then
      echo "$dir"
      return
    fi
  done

  # Not found
  return 1
}

# Get task status from task.json
get_task_status() {
  local task_dir="$1"
  local task_json="$task_dir/$FILE_TASK_JSON"

  if [[ -f "$task_json" ]] && command -v jq &> /dev/null; then
    jq -r '.status // "unknown"' "$task_json"
  else
    echo "unknown"
  fi
}

# Update task status
update_task_status() {
  local task_dir="$1"
  local new_status="$2"
  local task_json="$task_dir/$FILE_TASK_JSON"

  if [[ -f "$task_json" ]] && command -v jq &> /dev/null; then
    jq --arg status "$new_status" '.status = $status' "$task_json" > "${task_json}.tmp"
    mv "${task_json}.tmp" "$task_json"
  fi
}

# Get task field
get_task_field() {
  local task_dir="$1"
  local field="$2"
  local task_json="$task_dir/$FILE_TASK_JSON"

  if [[ -f "$task_json" ]] && command -v jq &> /dev/null; then
    jq -r ".$field // empty" "$task_json"
  fi
}

# Set task field
set_task_field() {
  local task_dir="$1"
  local field="$2"
  local value="$3"
  local task_json="$task_dir/$FILE_TASK_JSON"

  if [[ -f "$task_json" ]] && command -v jq &> /dev/null; then
    jq --arg val "$value" ".$field = \$val" "$task_json" > "${task_json}.tmp"
    mv "${task_json}.tmp" "$task_json"
  fi
}

# Get current phase from task
get_task_phase() {
  local task_dir="$1"
  get_task_field "$task_dir" "current_phase"
}

# Get next action from task
get_next_action() {
  local task_dir="$1"
  local phase="$2"
  local task_json="$task_dir/$FILE_TASK_JSON"

  if [[ -f "$task_json" ]] && command -v jq &> /dev/null; then
    jq -r ".next_action[] | select(.phase == $phase) | .action" "$task_json"
  fi
}
