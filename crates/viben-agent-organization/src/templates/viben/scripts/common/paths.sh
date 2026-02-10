#!/bin/bash
# Path constants and utilities for Viben workflow
#
# This file defines all path-related constants and helper functions.
# Source this file in other scripts to access these functions.

# =============================================================================
# Directory Names (relative to repo root)
# =============================================================================

DIR_WORKFLOW=".viben"
DIR_WORKSPACE="workspace"
DIR_TASKS="tasks"
DIR_SPEC="spec"
DIR_SCRIPTS="scripts"
DIR_ARCHIVE="archive"

# =============================================================================
# File Names
# =============================================================================

FILE_DEVELOPER=".developer"
FILE_CURRENT_TASK=".current-task"
FILE_TASK_JSON="task.json"
FILE_VERSION=".version"

# =============================================================================
# Helper Functions
# =============================================================================

# Get the repository root directory
get_repo_root() {
  git rev-parse --show-toplevel 2>/dev/null
}

# Get the viben workflow directory
get_workflow_dir() {
  local repo_root="${1:-$(get_repo_root)}"
  echo "$repo_root/$DIR_WORKFLOW"
}

# Get the workspace directory
get_workspace_dir() {
  local repo_root="${1:-$(get_repo_root)}"
  echo "$repo_root/$DIR_WORKFLOW/$DIR_WORKSPACE"
}

# Get the tasks directory
get_tasks_dir() {
  local repo_root="${1:-$(get_repo_root)}"
  echo "$repo_root/$DIR_WORKFLOW/$DIR_TASKS"
}

# Get the spec directory
get_spec_dir() {
  local repo_root="${1:-$(get_repo_root)}"
  echo "$repo_root/$DIR_WORKFLOW/$DIR_SPEC"
}

# Get current developer name
get_developer() {
  local repo_root="${1:-$(get_repo_root)}"
  local dev_file="$repo_root/$DIR_WORKFLOW/$FILE_DEVELOPER"
  if [[ -f "$dev_file" ]]; then
    cat "$dev_file" | tr -d '\n'
  fi
}

# Get current task path
get_current_task() {
  local repo_root="${1:-$(get_repo_root)}"
  local task_file="$repo_root/$DIR_WORKFLOW/$FILE_CURRENT_TASK"
  if [[ -f "$task_file" ]]; then
    cat "$task_file" | tr -d '\n'
  fi
}

# Set current task path
set_current_task() {
  local task_path="$1"
  local repo_root="${2:-$(get_repo_root)}"
  echo "$task_path" > "$repo_root/$DIR_WORKFLOW/$FILE_CURRENT_TASK"
}

# Clear current task
clear_current_task() {
  local repo_root="${1:-$(get_repo_root)}"
  rm -f "$repo_root/$DIR_WORKFLOW/$FILE_CURRENT_TASK"
}

# Generate task date prefix (MM-DD)
generate_task_date_prefix() {
  date +%m-%d
}
