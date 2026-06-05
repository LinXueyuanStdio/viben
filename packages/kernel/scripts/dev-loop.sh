#!/usr/bin/env bash
# Dev loop: builds and runs Viben, auto-restarts on exit code 75 (/restart command).
# Usage: ./scripts/dev-loop.sh
#
# Exit codes:
#   75 = restart requested → rebuild & restart
#   0  = normal exit → stop
#   *  = error → stop

set -euo pipefail

RESTART_CODE=75
export VIBEN_DEV_LOOP=1

build() {
  echo "▸ Building..."
  pnpm build
  echo "▸ Build complete."
}

# Initial build
build

while true; do
  echo "▸ Starting Viben..."
  set +e
  node dist/cli.js --foreground
  EXIT_CODE=$?
  set -e

  if [ "$EXIT_CODE" -eq "$RESTART_CODE" ]; then
    echo ""
    echo "▸ Restart requested (exit code $RESTART_CODE). Rebuilding..."
    # Inherit instance root from previous run so we don't re-prompt
    ROOT_FILE="${TMPDIR:-/tmp}/viben-dev-loop-root"
    if [ -f "$ROOT_FILE" ]; then
      export VIBEN_INSTANCE_ROOT="$(cat "$ROOT_FILE")"
    fi
    build
    echo "▸ Restarting..."
    echo ""
    continue
  fi

  echo "▸ Viben exited with code $EXIT_CODE."
  exit $EXIT_CODE
done
