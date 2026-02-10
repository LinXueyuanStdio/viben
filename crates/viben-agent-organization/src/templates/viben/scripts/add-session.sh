#!/bin/bash
# Add session record to developer journal
#
# Usage:
#   ./.viben/scripts/add-session.sh --title "Title" --commit "hash" [--summary "summary"]
#   echo "content" | ./.viben/scripts/add-session.sh --title "Title" --commit "hash"

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common/paths.sh"
source "$SCRIPT_DIR/common/developer.sh"

REPO_ROOT=$(get_repo_root)

# Parse arguments
TITLE=""
COMMIT=""
SUMMARY=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --title|-t) TITLE="$2"; shift 2 ;;
    --commit|-c) COMMIT="$2"; shift 2 ;;
    --summary|-s) SUMMARY="$2"; shift 2 ;;
    *) shift ;;
  esac
done

if [[ -z "$TITLE" ]]; then
  echo "Error: --title is required" >&2
  echo "Usage: $0 --title \"Session Title\" --commit \"hash\" [--summary \"summary\"]" >&2
  exit 1
fi

# Get developer info
developer=$(get_developer "$REPO_ROOT")
if [[ -z "$developer" ]]; then
  echo "Error: Developer not initialized" >&2
  exit 1
fi

developer_workspace=$(get_developer_workspace "$REPO_ROOT")
journal_file=$(get_current_journal "$REPO_ROOT")

# Check for rotation
if needs_journal_rotation "$journal_file"; then
  journal_file=$(create_next_journal "$REPO_ROOT")
  echo "Created new journal: $journal_file"
fi

# Get session number
session_num=1
if [[ -f "$journal_file" ]]; then
  session_num=$(grep -c "^## Session" "$journal_file" 2>/dev/null || echo "0")
  session_num=$((session_num + 1))
fi

# Build session content
today=$(date +%Y-%m-%d)
time_now=$(date +%H:%M)

# Read stdin if available
stdin_content=""
if [[ ! -t 0 ]]; then
  stdin_content=$(cat)
fi

# Append to journal
cat >> "$journal_file" << EOF

---

## Session $session_num: $TITLE

**Date**: $today $time_now
EOF

if [[ -n "$COMMIT" ]]; then
  echo "**Commits**: \`$COMMIT\`" >> "$journal_file"
fi

echo "" >> "$journal_file"

if [[ -n "$SUMMARY" ]]; then
  cat >> "$journal_file" << EOF
### Summary

$SUMMARY
EOF
fi

if [[ -n "$stdin_content" ]]; then
  cat >> "$journal_file" << EOF

### Details

$stdin_content
EOF
fi

echo "" >> "$journal_file"
echo "### Status" >> "$journal_file"
echo "" >> "$journal_file"
echo "[OK] **Recorded**" >> "$journal_file"

# Update index stats
index_file="$developer_workspace/index.md"
if [[ -f "$index_file" ]]; then
  # Update Last Active date and Total Sessions
  local current_sessions=$(grep -oP 'Total Sessions \| \K\d+' "$index_file" 2>/dev/null || echo "0")
  local new_sessions=$((current_sessions + 1))

  # Use sed to update stats (simple replacement)
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' "s/Total Sessions | [0-9]*/Total Sessions | $new_sessions/" "$index_file"
    sed -i '' "s/Last Active | [0-9-]*/Last Active | $today/" "$index_file"
  else
    sed -i "s/Total Sessions | [0-9]*/Total Sessions | $new_sessions/" "$index_file"
    sed -i "s/Last Active | [0-9-]*/Last Active | $today/" "$index_file"
  fi
fi

echo "Session recorded: $TITLE"
echo "Journal: $journal_file"
