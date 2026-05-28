#!/bin/bash
# Build all example apps from packages/*/example for GitHub Pages deployment.
#
# Usage: ./scripts/deploy-pages/build-examples.sh [--out <dir>]
#
#   --out <dir>  Output directory to copy built examples into (default: ./build/examples)
#
# Each example is built with VITE_BASE_PATH set to /<repo>/examples/<name>/
# where <repo> is derived from the git remote or defaults to "viben".

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
SCRIPTS_DIR="$ROOT_DIR/scripts"

OUT_DIR="$ROOT_DIR/build/examples"
REPO_NAME=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --out) OUT_DIR="$2"; shift 2 ;;
        --repo) REPO_NAME="$2"; shift 2 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

if [ -z "$REPO_NAME" ]; then
    REPO_NAME=$(basename "$(git -C "$ROOT_DIR" remote get-url origin 2>/dev/null | sed 's/\.git$//')" 2>/dev/null || echo "viben")
fi

EXAMPLES=$(find "$ROOT_DIR/packages" -maxdepth 2 -name "example" -type d | sort)

if [ -z "$EXAMPLES" ]; then
    echo "No examples found under packages/*/example"
    exit 0
fi

echo "🔨 Building examples..."

for EXAMPLE_DIR in $EXAMPLES; do
    PKG_NAME=$(basename "$(dirname "$EXAMPLE_DIR")")

    if [ ! -f "$EXAMPLE_DIR/package.json" ]; then
        continue
    fi

    HAS_BUILD=$(node -e "
        const pkg = require('$EXAMPLE_DIR/package.json');
        console.log(pkg.scripts && pkg.scripts.build ? 'yes' : 'no');
    " 2>/dev/null || echo "no")

    if [ "$HAS_BUILD" != "yes" ]; then
        echo "  ⏭  $PKG_NAME/example (no build script)"
        continue
    fi

    echo "  📦 Building deps for $PKG_NAME/example..."
    "$SCRIPTS_DIR/build-deps.sh" "$EXAMPLE_DIR" --force

    BASE_PATH="/$REPO_NAME/examples/$PKG_NAME/"
    echo "  🔨 Building $PKG_NAME/example (base: $BASE_PATH)..."
    (cd "$EXAMPLE_DIR" && VITE_BASE_PATH="$BASE_PATH" pnpm build)

    mkdir -p "$OUT_DIR/$PKG_NAME"
    cp -r "$EXAMPLE_DIR/dist/"* "$OUT_DIR/$PKG_NAME/"
    echo "  ✅ $PKG_NAME/example → $OUT_DIR/$PKG_NAME"
done

echo ""
echo "📄 Generating index.html..."
python3 "$SCRIPT_DIR/generate-examples-index.py" --out-dir "$OUT_DIR"

echo "✅ All examples built → $OUT_DIR"
