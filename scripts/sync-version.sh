#!/usr/bin/env bash
# Sync version across all package.json files
# Usage: scripts/sync-version.sh <version>
set -euo pipefail

VERSION="${1:?Usage: sync-version.sh <version>}"

update_json_version() {
  local file="$1"
  if [ -f "$file" ]; then
    jq --arg v "$VERSION" '.version = $v' "$file" > "${file}.tmp"
    mv "${file}.tmp" "$file"
    echo "  Updated: $file"
  else
    echo "  Skipped (not found): $file"
  fi
}

echo "Syncing version to: ${VERSION}"
update_json_version "package.json"
update_json_version "packages/core/package.json"
update_json_version "apps/cli/package.json"
update_json_version "apps/desktop/src-tauri/tauri.conf.json"
echo "Done."
