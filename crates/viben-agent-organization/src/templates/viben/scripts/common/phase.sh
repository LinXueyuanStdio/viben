#!/bin/bash
# Phase management utilities for multi-agent pipeline
#
# Source this file after paths.sh and task-queue.sh

# =============================================================================
# Phase Constants
# =============================================================================

PHASE_IMPLEMENT=1
PHASE_CHECK=2
PHASE_FINISH=3
PHASE_CREATE_PR=4

# =============================================================================
# Phase Functions
# =============================================================================

# Get phase name from number
get_phase_name() {
  local phase="$1"
  case "$phase" in
    1) echo "implement" ;;
    2) echo "check" ;;
    3) echo "finish" ;;
    4) echo "create-pr" ;;
    *) echo "unknown" ;;
  esac
}

# Get phase number from name
get_phase_number() {
  local name="$1"
  case "$name" in
    implement) echo "1" ;;
    check) echo "2" ;;
    finish) echo "3" ;;
    create-pr) echo "4" ;;
    *) echo "0" ;;
  esac
}

# Advance to next phase
advance_phase() {
  local task_dir="$1"
  local current=$(get_task_phase "$task_dir")
  local next=$((current + 1))

  set_task_field "$task_dir" "current_phase" "$next"
  echo "$next"
}

# Check if all phases complete
is_pipeline_complete() {
  local task_dir="$1"
  local current=$(get_task_phase "$task_dir")
  [[ "$current" -ge "$PHASE_CREATE_PR" ]]
}

# Get current phase action
get_current_action() {
  local task_dir="$1"
  local phase=$(get_task_phase "$task_dir")
  get_next_action "$task_dir" "$phase"
}

# Mark phase as complete
complete_phase() {
  local task_dir="$1"
  local phase="$2"
  local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  # Update task.json with completion info
  local task_json="$task_dir/$FILE_TASK_JSON"
  if [[ -f "$task_json" ]] && command -v jq &> /dev/null; then
    jq --arg phase "$phase" --arg time "$timestamp" \
      '.phase_completed[$phase] = $time' "$task_json" > "${task_json}.tmp"
    mv "${task_json}.tmp" "$task_json"
  fi
}
