#!/usr/bin/env bash
#
# Run the local macOS release path before publishing.
#
# By default this orchestrates the macOS parts of .github/workflows/release-all.yml:
#   - install dependencies
#   - build macOS bundled sidecars
#   - run bundled CLI + gateway tests
#   - build macOS desktop DMGs
#   - run the macOS desktop smoke test against the DMG
#
# Usage:
#   scripts/macos/check_before_release.sh [--version <version>] [--skip-desktop-tests]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SIDECAR_ARTIFACT_DIR="$REPO_ROOT/artifacts/macos/sidecar"
DESKTOP_ARTIFACT_DIR="$REPO_ROOT/artifacts/macos/desktop"
VERSION=""
SKIP_DESKTOP_TESTS=false

usage() {
  sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version|-v)
      VERSION="${2:?Missing value for --version}"
      shift 2
      ;;
    --skip-desktop-tests)
      SKIP_DESKTOP_TESTS=true
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

cd "$REPO_ROOT"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This script must run on macOS." >&2
  exit 1
fi

require_cmd jq
require_cmd pnpm
require_cmd bun
require_cmd cargo
require_cmd rustup
require_cmd codesign
require_cmd curl

if [[ -z "$VERSION" ]]; then
  VERSION="$(jq -r '.version' "$REPO_ROOT/package.json")"
fi

echo "==> Local macOS release check"
echo "Version: $VERSION"
echo "Repository: $REPO_ROOT"

pnpm install --frozen-lockfile

"$SCRIPT_DIR/build-cli.sh" --version "$VERSION" --skip-install

node "$REPO_ROOT/apps/cli/dist/index.js" --version
node "$REPO_ROOT/apps/cli/dist/index.js" --help
"$REPO_ROOT/scripts/test-cli.sh" --local
test -d "$SIDECAR_ARTIFACT_DIR/templates"

CLI_BINARY="$SIDECAR_ARTIFACT_DIR/viben-aarch64-apple-darwin"
if [[ "$(uname -m)" == "x86_64" ]]; then
  CLI_BINARY="$SIDECAR_ARTIFACT_DIR/viben-x86_64-apple-darwin"
fi

"$REPO_ROOT/scripts/macos/test-cli-gateway.sh" "$CLI_BINARY"

"$SCRIPT_DIR/build-desktop.sh" --version "$VERSION" --skip-install --skip-sidecar-build

if [[ "$SKIP_DESKTOP_TESTS" != "true" ]]; then
  rm -rf "$REPO_ROOT/desktop-artifact"
  mkdir -p "$REPO_ROOT/desktop-artifact"
  cp "$DESKTOP_ARTIFACT_DIR"/*.dmg "$REPO_ROOT/desktop-artifact"/
  "$REPO_ROOT/scripts/macos/test-desktop-ui.sh"
fi

echo "==> macOS release check complete"
echo "Sidecars: $SIDECAR_ARTIFACT_DIR"
echo "Desktop artifacts: $DESKTOP_ARTIFACT_DIR"
