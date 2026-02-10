#!/bin/bash
# Agent registry utilities for multi-agent development
#
# Source this file after paths.sh

# =============================================================================
# Registry Constants
# =============================================================================

REGISTRY_FILE="agents/registry.json"

# =============================================================================
# Registry Functions
# =============================================================================

# Get registry file path
get_registry_path() {
  local repo_root="${1:-$(get_repo_root)}"
  echo "$repo_root/$DIR_WORKFLOW/$REGISTRY_FILE"
}

# Initialize registry if not exists
init_registry() {
  local repo_root="${1:-$(get_repo_root)}"
  local registry_path=$(get_registry_path "$repo_root")
  local registry_dir=$(dirname "$registry_path")

  mkdir -p "$registry_dir"

  if [[ ! -f "$registry_path" ]]; then
    echo '{"agents": [], "created_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' > "$registry_path"
  fi
}

# Register an agent
register_agent() {
  local task_name="$1"
  local pid="$2"
  local worktree="$3"
  local repo_root="${4:-$(get_repo_root)}"

  init_registry "$repo_root"
  local registry_path=$(get_registry_path "$repo_root")

  if command -v jq &> /dev/null; then
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    jq --arg name "$task_name" --arg pid "$pid" --arg wt "$worktree" --arg ts "$timestamp" \
      '.agents += [{"name": $name, "pid": ($pid | tonumber), "worktree": $wt, "started_at": $ts, "status": "running"}]' \
      "$registry_path" > "${registry_path}.tmp"
    mv "${registry_path}.tmp" "$registry_path"
  fi
}

# Unregister an agent
unregister_agent() {
  local task_name="$1"
  local repo_root="${2:-$(get_repo_root)}"
  local registry_path=$(get_registry_path "$repo_root")

  if [[ -f "$registry_path" ]] && command -v jq &> /dev/null; then
    jq --arg name "$task_name" \
      '.agents = [.agents[] | select(.name != $name)]' \
      "$registry_path" > "${registry_path}.tmp"
    mv "${registry_path}.tmp" "$registry_path"
  fi
}

# Update agent status
update_agent_status() {
  local task_name="$1"
  local status="$2"
  local repo_root="${3:-$(get_repo_root)}"
  local registry_path=$(get_registry_path "$repo_root")

  if [[ -f "$registry_path" ]] && command -v jq &> /dev/null; then
    jq --arg name "$task_name" --arg status "$status" \
      '(.agents[] | select(.name == $name)).status = $status' \
      "$registry_path" > "${registry_path}.tmp"
    mv "${registry_path}.tmp" "$registry_path"
  fi
}

# Get registered agents
list_agents() {
  local repo_root="${1:-$(get_repo_root)}"
  local registry_path=$(get_registry_path "$repo_root")

  if [[ -f "$registry_path" ]] && command -v jq &> /dev/null; then
    jq -r '.agents[] | "\(.name)\t\(.status)\t\(.pid)"' "$registry_path"
  fi
}

# Count running agents
count_running_agents() {
  local repo_root="${1:-$(get_repo_root)}"
  local registry_path=$(get_registry_path "$repo_root")

  if [[ -f "$registry_path" ]] && command -v jq &> /dev/null; then
    jq '[.agents[] | select(.status == "running")] | length' "$registry_path"
  else
    echo "0"
  fi
}

# Check if agent is running
is_agent_running() {
  local task_name="$1"
  local repo_root="${2:-$(get_repo_root)}"
  local registry_path=$(get_registry_path "$repo_root")

  if [[ -f "$registry_path" ]] && command -v jq &> /dev/null; then
    local status=$(jq -r --arg name "$task_name" '.agents[] | select(.name == $name) | .status' "$registry_path")
    [[ "$status" == "running" ]]
  else
    return 1
  fi
}
