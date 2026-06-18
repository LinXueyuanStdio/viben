#!/usr/bin/env bash
#
# Build the macOS desktop release artifacts using the bundled sidecars.
#
# This mirrors the macOS build-desktop job in .github/workflows/release-all.yml:
#   - ensure both macOS Rust targets are installed
#   - ensure sidecars exist and are executable
#   - ad-hoc codesign sidecars
#   - build workspace packages needed by @viben/desktop
#   - sync versions
#   - build Tauri DMGs for aarch64 and x86_64
#   - copy DMGs into artifacts/macos/desktop
#
# Usage:
#   scripts/macos/build-desktop.sh [--version <version>] [--skip-install] [--skip-sidecar-build]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BINARIES_DIR="$REPO_ROOT/apps/desktop/src-tauri/binaries"
ENTITLEMENTS="$REPO_ROOT/apps/desktop/src-tauri/entitlements.plist"
DESKTOP_ARTIFACT_DIR="$REPO_ROOT/artifacts/macos/desktop"
SIDECAR_ARTIFACT_DIR="$REPO_ROOT/artifacts/macos/sidecar"
TAURI_SIGNING_PRIVATE_KEY_FILE="${TAURI_SIGNING_PRIVATE_KEY_FILE:-$HOME/.tauri/viben.key}"

VERSION=""
SKIP_INSTALL=false
SKIP_SIDECAR_BUILD=false

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
    --skip-sidecar-build)
      SKIP_SIDECAR_BUILD=true
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

require_sidecar() {
  local path="$1"
  if [[ ! -x "$path" ]]; then
    echo "Missing executable sidecar: $path" >&2
    echo "Run scripts/macos/build-cli.sh first, or omit --skip-sidecar-build." >&2
    exit 1
  fi
}

cleanup_stale_tauri_dmg_state() {
  local target_dir="$REPO_ROOT/apps/desktop/src-tauri/target"

  while IFS= read -r image_path; do
    [[ -n "$image_path" ]] || continue
    while IFS= read -r device; do
      [[ -n "$device" ]] || continue
      echo "Detaching stale DMG device $device for $image_path"
      hdiutil detach "$device" || hdiutil detach -force "$device" || true
    done < <(hdiutil info | awk -v image="$image_path" '
      $1 == "image-path" && index($0, image) { in_image = 1; next }
      in_image && $1 ~ /^\/dev\// { print $1; in_image = 0 }
    ')
  done < <(find "$target_dir" -name "rw.*.dmg" -type f 2>/dev/null || true)

  find "$target_dir" -name "rw.*.dmg" -type f -delete 2>/dev/null || true
}

cd "$REPO_ROOT"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This script must run on macOS." >&2
  exit 1
fi

require_cmd jq
require_cmd pnpm
require_cmd rustup
require_cmd cargo
require_cmd codesign

if [[ -z "${TAURI_SIGNING_PRIVATE_KEY:-}" && -f "$TAURI_SIGNING_PRIVATE_KEY_FILE" ]]; then
  echo "Using Tauri updater signing key from TAURI_SIGNING_PRIVATE_KEY_FILE"
  TAURI_SIGNING_PRIVATE_KEY="$(<"$TAURI_SIGNING_PRIVATE_KEY_FILE")"
  export TAURI_SIGNING_PRIVATE_KEY
fi

if [[ -z "$VERSION" ]]; then
  VERSION="$(jq -r '.version' "$REPO_ROOT/package.json")"
fi

echo "==> macOS desktop build"
echo "Version: $VERSION"
echo "Repository: $REPO_ROOT"

if [[ "$SKIP_INSTALL" != "true" ]]; then
  pnpm install --frozen-lockfile
fi

rustup target add aarch64-apple-darwin x86_64-apple-darwin

if [[ "$SKIP_SIDECAR_BUILD" != "true" ]]; then
  "$SCRIPT_DIR/build-cli.sh" --version "$VERSION" --skip-install
elif [[ -d "$SIDECAR_ARTIFACT_DIR" ]]; then
  mkdir -p "$BINARIES_DIR"
  cp "$SIDECAR_ARTIFACT_DIR"/viben-*apple-darwin "$BINARIES_DIR"/
fi

require_sidecar "$BINARIES_DIR/viben-aarch64-apple-darwin"
require_sidecar "$BINARIES_DIR/viben-x86_64-apple-darwin"

chmod +x "$BINARIES_DIR"/viben-*apple-darwin
sign_sidecars

pnpm turbo build --filter=@viben/desktop^...
"$REPO_ROOT/scripts/sync-version.sh" "$VERSION"

cleanup_stale_tauri_dmg_state
pnpm --filter @viben/desktop tauri build --target aarch64-apple-darwin --ci
cleanup_stale_tauri_dmg_state
pnpm --filter @viben/desktop tauri build --target x86_64-apple-darwin --ci

rm -rf "$DESKTOP_ARTIFACT_DIR"
mkdir -p "$DESKTOP_ARTIFACT_DIR"
find "$REPO_ROOT/apps/desktop/src-tauri/target" -name "*.dmg" -type f -exec cp {} "$DESKTOP_ARTIFACT_DIR"/ \;

echo "==> Desktop artifacts"
ls -la "$DESKTOP_ARTIFACT_DIR"
