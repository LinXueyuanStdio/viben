#!/bin/bash
# Build all example apps from packages/*/example for GitHub Pages deployment.
#
# Usage: ./scripts/build-examples.sh [--out <dir>]
#
#   --out <dir>  Output directory to copy built examples into (default: ./build/examples)
#
# Each example is built with VITE_BASE_PATH set to /<repo>/examples/<name>/
# where <repo> is derived from the git remote or defaults to "viben".

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
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

BUILT_EXAMPLES=$(find "$OUT_DIR" -maxdepth 1 -mindepth 1 -type d | sort)
INDEX_FILE="$OUT_DIR/index.html"

cat > "$INDEX_FILE" <<'HEADER'
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Viben Examples</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 600px; margin: 4rem auto; padding: 0 1rem; }
  h1 { font-size: 1.5rem; margin-bottom: 2rem; }
  ul { list-style: none; padding: 0; }
  li { margin: 0.75rem 0; }
  a { color: #2563eb; text-decoration: none; font-size: 1.1rem; }
  a:hover { text-decoration: underline; }
</style>
</head>
<body>
<h1>Viben Examples</h1>
<ul>
HEADER

for DIR in $BUILT_EXAMPLES; do
    NAME=$(basename "$DIR")
    echo "  <li><a href=\"./$NAME/\">$NAME</a></li>" >> "$INDEX_FILE"
done

cat >> "$INDEX_FILE" <<'FOOTER'
</ul>
</body>
</html>
FOOTER

echo "✅ All examples built → $OUT_DIR"
