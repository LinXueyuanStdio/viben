#!/bin/bash
# Planning script for multi-agent pipeline
#
# Usage:
#   ./.viben/scripts/multi-agent/plan.sh --name <name> --type <type> --requirement "<desc>"

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../common/paths.sh"

REPO_ROOT=$(get_repo_root)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Parse arguments
NAME=""
TYPE="fullstack"
REQUIREMENT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --name|-n) NAME="$2"; shift 2 ;;
    --type|-t) TYPE="$2"; shift 2 ;;
    --requirement|-r) REQUIREMENT="$2"; shift 2 ;;
    *) shift ;;
  esac
done

if [[ -z "$NAME" ]] || [[ -z "$REQUIREMENT" ]]; then
  echo -e "${RED}Error: --name and --requirement are required${NC}"
  echo "Usage: $0 --name <name> --type <backend|frontend|fullstack> --requirement \"description\""
  exit 1
fi

echo -e "${BLUE}=== Planning: $NAME ===${NC}"
echo "Type: $TYPE"
echo "Requirement: $REQUIREMENT"
echo ""

# Create task
TASK_DIR=$("$SCRIPT_DIR/../task.sh" create "$REQUIREMENT" --slug "$NAME")
echo "Task created: $TASK_DIR"

# Initialize context
"$SCRIPT_DIR/../task.sh" init-context "$TASK_DIR" "$TYPE"

# Create prd.md
PRD_FILE="$REPO_ROOT/$TASK_DIR/prd.md"
cat > "$PRD_FILE" << EOF
# Feature: $NAME

## Requirements

$REQUIREMENT

## Acceptance Criteria

- [ ] Feature implemented according to requirements
- [ ] Code follows project guidelines
- [ ] Tests pass (if applicable)
- [ ] No lint errors

## Technical Notes

(To be filled by implement agent)

## Related Files

(To be identified by implement agent)
EOF

echo -e "${GREEN}PRD created: $PRD_FILE${NC}"

# Set branch
BRANCH="task/$NAME"
"$SCRIPT_DIR/../task.sh" set-branch "$TASK_DIR" "$BRANCH"

echo ""
echo -e "${GREEN}=== Planning Complete ===${NC}"
echo ""
echo "Task directory: $TASK_DIR"
echo "Branch: $BRANCH"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Review/edit: $PRD_FILE"
echo "  2. Start pipeline: ./.viben/scripts/multi-agent/start.sh $TASK_DIR"
