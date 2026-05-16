#!/bin/bash
# Scan ~/.claude/projects for large session JSONL files (>2MB)
# containing subagent/task/ask_question/task_update patterns.
# Outputs randomly selected paths to .test_session_paths.
#
# Usage:
#   bash example/scripts/scan-sessions.sh [count=10]

set -euo pipefail

COUNT="${1:-10}"
PROJECTS_DIR="$HOME/.claude/projects"
OUTFILE="$(cd "$(dirname "$0")/.." && pwd)/.test_session_paths"
MIN_SIZE=$((2 * 1024 * 1024))  # 2MB

echo "Scanning $PROJECTS_DIR for sessions >2MB with rich content..."

CANDIDATES=()

while IFS= read -r jsonl; do
  size=$(stat -f%z "$jsonl" 2>/dev/null || stat -c%s "$jsonl" 2>/dev/null || echo 0)
  if [ "$size" -lt "$MIN_SIZE" ]; then
    continue
  fi

  # Require at least 2 of 4 pattern categories
  score=0
  grep -q '"Agent"' "$jsonl" 2>/dev/null && score=$((score + 1))
  grep -q '"TaskCreate"\|"TaskUpdate"\|"TodoWrite"' "$jsonl" 2>/dev/null && score=$((score + 1))
  grep -q '"AskUserQuestion"\|"ask_question"' "$jsonl" 2>/dev/null && score=$((score + 1))
  grep -q '"SendMessage"\|"subagent"' "$jsonl" 2>/dev/null && score=$((score + 1))

  if [ "$score" -ge 2 ]; then
    size_mb=$(echo "scale=1; $size / 1048576" | bc)
    CANDIDATES+=("$size $jsonl")
    echo "  [${size_mb}MB] $(basename "$jsonl")"
  fi
done < <(find "$PROJECTS_DIR" -maxdepth 2 -name "*.jsonl" -type f 2>/dev/null | grep -v '/subagents/')

echo ""
echo "Found ${#CANDIDATES[@]} qualifying sessions."

if [ "${#CANDIDATES[@]}" -eq 0 ]; then
  echo "No qualifying sessions found." >&2
  exit 1
fi

# Sort by size descending, pick top N (prioritize large files)
printf '%s\n' "${CANDIDATES[@]}" \
  | sort -rn \
  | head -n "$COUNT" \
  | awk '{print $2}' \
  > "$OUTFILE"

selected=$(wc -l < "$OUTFILE" | tr -d ' ')
echo "Wrote $selected paths to $OUTFILE"
cat "$OUTFILE"
