#!/usr/bin/env bash
#
# Build the macOS bundled Viben CLI sidecars used by the Tauri desktop app.
#
# This mirrors the macOS parts of .github/workflows/release-all.yml:
#   - sync versions
#   - build @viben/core
#   - build the npm CLI package
#   - compile packages/core/dist/cli/bin.js into both macOS Tauri sidecars
#   - ad-hoc codesign the sidecars with the Tauri entitlements
#   - copy the sidecars into artifacts/macos/sidecar
#
# Usage:
#   scripts/macos/build-cli.sh [--version <version>] [--skip-install]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BINARIES_DIR="$REPO_ROOT/apps/desktop/src-tauri/binaries"
ENTITLEMENTS="$REPO_ROOT/apps/desktop/src-tauri/entitlements.plist"
ARTIFACT_DIR="$REPO_ROOT/artifacts/macos/sidecar"
TAURI_TEMPLATES_DIR="$REPO_ROOT/apps/desktop/src-tauri/resources/templates"

VERSION=""
SKIP_INSTALL=false

usage() {
  sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version|-v)
      VERSION="${2:?Missing value for --version}"
      shift 2
      ;;
    --skip-install)
      SKIP_INSTALL=true
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

sign_sidecars() {
  for bin in "$BINARIES_DIR"/viben-*apple-darwin; do
    [[ -f "$bin" ]] || continue
    echo "Signing $bin"
    codesign --remove-signature "$bin" 2>/dev/null || true
    codesign --entitlements "$ENTITLEMENTS" --deep --sign - --force "$bin"
  done
}

cd "$REPO_ROOT"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This script must run on macOS." >&2
  exit 1
fi

require_cmd jq
require_cmd pnpm
require_cmd bun
require_cmd codesign

if [[ -z "$VERSION" ]]; then
  VERSION="$(jq -r '.version' "$REPO_ROOT/package.json")"
fi

echo "==> macOS CLI sidecar build"
echo "Version: $VERSION"
echo "Repository: $REPO_ROOT"

if [[ "$SKIP_INSTALL" != "true" ]]; then
  pnpm install --frozen-lockfile
fi

"$REPO_ROOT/scripts/sync-version.sh" "$VERSION"

pnpm turbo build --filter=@viben/core
pnpm turbo build --filter=viben

mkdir -p "$BINARIES_DIR" "$ARTIFACT_DIR"

(
  cd "$REPO_ROOT/packages/core"
  bun build dist/cli/bin.js \
    --compile \
    --target bun-darwin-arm64 \
    --outfile "$BINARIES_DIR/viben-aarch64-apple-darwin"
  bun build dist/cli/bin.js \
    --compile \
    --target bun-darwin-x64 \
    --outfile "$BINARIES_DIR/viben-x86_64-apple-darwin"
)

chmod +x "$BINARIES_DIR"/viben-*apple-darwin
sign_sidecars

rm -rf "$ARTIFACT_DIR"
mkdir -p "$ARTIFACT_DIR"
cp "$BINARIES_DIR"/viben-*apple-darwin "$ARTIFACT_DIR"/
cp -R "$REPO_ROOT/packages/core/templates" "$ARTIFACT_DIR/templates"

rm -rf "$TAURI_TEMPLATES_DIR"
mkdir -p "$(dirname "$TAURI_TEMPLATES_DIR")"
cp -R "$REPO_ROOT/packages/core/templates" "$TAURI_TEMPLATES_DIR"

echo "==> Sidecar artifacts"
ls -la "$ARTIFACT_DIR"
