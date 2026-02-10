#!/bin/bash
# Create bootstrap script for AI agent sessions
#
# This script generates a bootstrap.md file that can be used to quickly
# set up an AI agent session with the necessary context.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common/paths.sh"
source "$SCRIPT_DIR/common/developer.sh"

REPO_ROOT=$(get_repo_root)
OUTPUT_FILE="${1:-bootstrap.md}"

developer=$(get_developer "$REPO_ROOT")
current_task=$(get_current_task "$REPO_ROOT")

cat > "$OUTPUT_FILE" << 'EOF'
# AI Agent Bootstrap

Execute these commands to initialize your session:

## 1. Get Context

```bash
./.viben/scripts/get-context.sh
```

## 2. Read Workflow

```bash
cat .viben/workflow.md
```

## 3. Read Guidelines

Based on your task type:

**Frontend**:
```bash
cat .viben/spec/frontend/index.md
```

**Backend**:
```bash
cat .viben/spec/backend/index.md
```

## 4. Start Development

```bash
# List tasks
./.viben/scripts/task.sh list

# Create or start task
./.viben/scripts/task.sh create "Task title" --slug task-name
./.viben/scripts/task.sh start .viben/tasks/MM-DD-task-name
```

## 5. After Completion

```bash
# Record session
./.viben/scripts/add-session.sh --title "Session Title" --commit "hash"
```

---

Remember:
- [!] Read guidelines before coding
- [!] AI should NOT execute git commit
- [OK] Record sessions after work
EOF

echo "Bootstrap created: $OUTPUT_FILE"
