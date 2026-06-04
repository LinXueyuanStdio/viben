#!/usr/bin/env sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(dirname "$SCRIPT_DIR")

if ! command -v git >/dev/null 2>&1; then
  exit 0
fi

if ! git -C "$PROJECT_ROOT" rev-parse --git-dir >/dev/null 2>&1; then
  exit 0
fi

if git -C "$PROJECT_ROOT" config core.hooksPath .githooks; then
  exit 0
fi

echo "Could not configure Git hooks. Run 'git config core.hooksPath .githooks' manually." >&2
