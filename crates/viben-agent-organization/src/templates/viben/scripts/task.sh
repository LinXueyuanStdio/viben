#!/bin/bash
# Task Management Script for Multi-Agent Pipeline
#
# Usage:
#   ./.viben/scripts/task.sh create "<title>" [--slug <name>]
#   ./.viben/scripts/task.sh init-context <dir> <type>
#   ./.viben/scripts/task.sh add-context <dir> <file> <path> [reason]
#   ./.viben/scripts/task.sh validate <dir>
#   ./.viben/scripts/task.sh start <dir>
#   ./.viben/scripts/task.sh finish
#   ./.viben/scripts/task.sh archive <task-name>
#   ./.viben/scripts/task.sh list

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common/paths.sh"
source "$SCRIPT_DIR/common/developer.sh"
source "$SCRIPT_DIR/common/task-queue.sh"
source "$SCRIPT_DIR/common/task-utils.sh"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

REPO_ROOT=$(get_repo_root)

# Convert title to slug
_slugify() {
  echo "$1" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//'
}

# Ensure tasks directory exists
ensure_tasks_dir() {
  local tasks_dir=$(get_tasks_dir)
  mkdir -p "$tasks_dir"
  mkdir -p "$tasks_dir/archive"
}

# Create new task
cmd_create() {
  local title=""
  local slug=""
  local assignee=""
  local priority="P2"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --slug|-s) slug="$2"; shift 2 ;;
      --assignee|-a) assignee="$2"; shift 2 ;;
      --priority|-p) priority="$2"; shift 2 ;;
      *) [[ -z "$title" ]] && title="$1"; shift ;;
    esac
  done

  if [[ -z "$title" ]]; then
    echo -e "${RED}Error: title is required${NC}" >&2
    exit 1
  fi

  [[ -z "$assignee" ]] && assignee=$(get_developer "$REPO_ROOT")
  [[ -z "$slug" ]] && slug=$(_slugify "$title")

  ensure_tasks_dir

  local tasks_dir=$(get_tasks_dir)
  local date_prefix=$(generate_task_date_prefix)
  local dir_name="${date_prefix}-${slug}"
  local task_dir="$tasks_dir/$dir_name"
  local task_json="$task_dir/$FILE_TASK_JSON"

  mkdir -p "$task_dir"

  local today=$(date +%Y-%m-%d)
  local current_branch=$(git branch --show-current 2>/dev/null || echo "main")

  cat > "$task_json" << EOF
{
  "id": "$slug",
  "name": "$slug",
  "title": "$title",
  "status": "planning",
  "dev_type": null,
  "priority": "$priority",
  "creator": "$assignee",
  "assignee": "$assignee",
  "createdAt": "$today",
  "completedAt": null,
  "branch": null,
  "base_branch": "$current_branch",
  "current_phase": 0,
  "next_action": [
    {"phase": 1, "action": "implement"},
    {"phase": 2, "action": "check"},
    {"phase": 3, "action": "finish"},
    {"phase": 4, "action": "create-pr"}
  ]
}
EOF

  echo -e "${GREEN}Created task: $dir_name${NC}" >&2
  echo "$DIR_WORKFLOW/$DIR_TASKS/$dir_name"
}

# Initialize context files
cmd_init_context() {
  local target_dir="$1"
  local dev_type="$2"

  if [[ -z "$target_dir" ]] || [[ -z "$dev_type" ]]; then
    echo -e "${RED}Error: Missing arguments${NC}"
    echo "Usage: $0 init-context <task-dir> <dev_type>"
    exit 1
  fi

  [[ ! "$target_dir" = /* ]] && target_dir="$REPO_ROOT/$target_dir"

  echo -e "${BLUE}=== Initializing Context Files ===${NC}"

  # implement.jsonl
  cat > "$target_dir/implement.jsonl" << EOF
{"file": "$DIR_WORKFLOW/workflow.md", "reason": "Project workflow"}
{"file": "$DIR_WORKFLOW/$DIR_SPEC/shared/index.md", "reason": "Shared standards"}
EOF

  # check.jsonl
  cat > "$target_dir/check.jsonl" << EOF
{"file": ".claude/commands/viben/finish-work.md", "reason": "Finish checklist"}
{"file": "$DIR_WORKFLOW/$DIR_SPEC/shared/index.md", "reason": "Shared standards"}
EOF

  # debug.jsonl
  cat > "$target_dir/debug.jsonl" << EOF
{"file": "$DIR_WORKFLOW/$DIR_SPEC/shared/index.md", "reason": "Shared standards"}
EOF

  echo -e "${GREEN}Context files created${NC}"
}

# Add context entry
cmd_add_context() {
  local target_dir="$1"
  local jsonl_name="$2"
  local path="$3"
  local reason="${4:-Added manually}"

  [[ ! "$target_dir" = /* ]] && target_dir="$REPO_ROOT/$target_dir"
  [[ "$jsonl_name" != *.jsonl ]] && jsonl_name="${jsonl_name}.jsonl"

  local jsonl_file="$target_dir/$jsonl_name"
  echo "{\"file\": \"$path\", \"reason\": \"$reason\"}" >> "$jsonl_file"
  echo -e "${GREEN}Added: $path${NC}"
}

# Start task
cmd_start() {
  local task_dir="$1"
  [[ "$task_dir" = /* ]] && task_dir="${task_dir#$REPO_ROOT/}"

  if [[ ! -d "$REPO_ROOT/$task_dir" ]]; then
    echo -e "${RED}Error: Task directory not found${NC}"
    exit 1
  fi

  set_current_task "$task_dir"
  echo -e "${GREEN}Current task: $task_dir${NC}"
}

# Finish task
cmd_finish() {
  local current=$(get_current_task)
  if [[ -z "$current" ]]; then
    echo -e "${YELLOW}No current task${NC}"
    exit 0
  fi
  clear_current_task
  echo -e "${GREEN}Cleared task: $current${NC}"
}

# Archive task
cmd_archive() {
  local task_name="$1"
  local tasks_dir=$(get_tasks_dir)
  local task_dir=$(find_task_by_name "$task_name" "$tasks_dir")

  if [[ -z "$task_dir" ]]; then
    echo -e "${RED}Error: Task not found: $task_name${NC}" >&2
    exit 1
  fi

  archive_task_complete "$task_dir" "$REPO_ROOT"
  echo -e "${GREEN}Archived: $task_name${NC}"
}

# List tasks
cmd_list() {
  local tasks_dir=$(get_tasks_dir)
  local current_task=$(get_current_task)

  echo -e "${BLUE}Active tasks:${NC}"
  echo ""

  local count=0
  for d in "$tasks_dir"/*/; do
    [[ ! -d "$d" ]] && continue
    local name=$(basename "$d")
    [[ "$name" == "archive" ]] && continue

    local status="unknown"
    local task_json="$d/$FILE_TASK_JSON"
    [[ -f "$task_json" ]] && status=$(jq -r '.status // "unknown"' "$task_json" 2>/dev/null)

    local marker=""
    [[ "$DIR_WORKFLOW/$DIR_TASKS/$name" == "$current_task" ]] && marker=" ${GREEN}<- current${NC}"

    echo -e "  - $name/ ($status)$marker"
    ((count++))
  done

  [[ $count -eq 0 ]] && echo "  (no active tasks)"
  echo ""
  echo "Total: $count task(s)"
}

# Show help
show_usage() {
  cat << EOF
Task Management Script

Usage:
  $0 create <title> [--slug <name>]   Create new task
  $0 init-context <dir> <type>        Initialize context files
  $0 add-context <dir> <jsonl> <path> Add context entry
  $0 start <dir>                      Set current task
  $0 finish                           Clear current task
  $0 archive <name>                   Archive task
  $0 list                             List tasks

Examples:
  $0 create "Add login" --slug add-login
  $0 init-context .viben/tasks/01-21-add-login backend
  $0 start .viben/tasks/01-21-add-login
EOF
}

# Main
case "${1:-}" in
  create) shift; cmd_create "$@" ;;
  init-context) shift; cmd_init_context "$@" ;;
  add-context) cmd_add_context "$2" "$3" "$4" "$5" ;;
  start) cmd_start "$2" ;;
  finish) cmd_finish ;;
  archive) cmd_archive "$2" ;;
  list) shift; cmd_list "$@" ;;
  -h|--help|help) show_usage ;;
  *) show_usage; exit 1 ;;
esac
