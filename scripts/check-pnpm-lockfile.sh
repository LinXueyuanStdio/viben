#!/usr/bin/env sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=${VIBEN_LOCKFILE_CHECK_ROOT:-$(dirname "$SCRIPT_DIR")}

cd "$PROJECT_ROOT"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required to verify pnpm-lock.yaml." >&2
  exit 1
fi

echo "Checking pnpm-lock.yaml..."

export CI=true
export NO_UPDATE_NOTIFIER=1

if pnpm install --lockfile-only --frozen-lockfile --ignore-scripts --offline; then
  echo "pnpm-lock.yaml is up to date."
  exit 0
fi

echo "Offline lockfile check could not complete; retrying with registry access..."

if pnpm install --lockfile-only --frozen-lockfile --ignore-scripts; then
  echo "pnpm-lock.yaml is up to date."
  exit 0
fi

echo "pnpm-lock.yaml is out of sync with package manifests." >&2
echo "Run 'pnpm install' and commit the updated pnpm-lock.yaml." >&2
exit 1
