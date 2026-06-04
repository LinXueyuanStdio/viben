#!/bin/bash
# Build workspace dependencies for a given package.
#
# Reads @viben/* and @yoopta/* workspace dependencies from the target package's
# package.json, then recursively builds any that have a "build" script and
# export from dist/.
#
# Usage: ./scripts/build-deps.sh <package-dir> [--force]
#
#   <package-dir>  Path to the package whose deps should be built (e.g. packages/core)
#   --force        Rebuild all deps even if dist/ exists

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGES_DIR="$ROOT_DIR/packages"
YOOPTA_DIR="$ROOT_DIR/infra/Yoopta-Editor/packages"

TARGET_DIR=""
FORCE=false

for arg in "$@"; do
    case "$arg" in
        --force) FORCE=true ;;
        *) TARGET_DIR="$arg" ;;
    esac
done

if [ -z "$TARGET_DIR" ] || [ ! -f "$TARGET_DIR/package.json" ]; then
    echo "Usage: build-deps.sh <package-dir> [--force]"
    exit 1
fi

# Normalize to absolute path (node require() needs absolute or ./ prefix)
TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"

# Track already-built packages (bash 3.x compatible - uses a delimited string)
BUILT_LIST=""

is_built() {
    case ",$BUILT_LIST," in
        *",$1,"*) return 0 ;;
        *) return 1 ;;
    esac
}

mark_built() {
    BUILT_LIST="${BUILT_LIST:+$BUILT_LIST,}$1"
}

# Build a single package's workspace deps recursively, then itself
build_pkg() {
    local pkg_dir="$1"
    local pkg_name
    pkg_name=$(basename "$pkg_dir")

    # Use realpath as unique key to avoid basename collisions (e.g. @viben/ui vs @yoopta/ui)
    local pkg_key
    pkg_key=$(cd "$pkg_dir" 2>/dev/null && pwd || echo "$pkg_dir")

    # Skip if already processed
    if is_built "$pkg_key"; then
        return
    fi
    mark_built "$pkg_key"

    # Extract @viben/* workspace deps from package.json
    local viben_deps
    viben_deps=$(node -e "
        const pkg = require('$pkg_dir/package.json');
        const all = { ...pkg.dependencies, ...pkg.devDependencies };
        Object.entries(all)
            .filter(([k, v]) => k.startsWith('@viben/') && v.startsWith('workspace:'))
            .map(([k]) => k.replace('@viben/', ''))
            .forEach(n => console.log(n));
    " 2>/dev/null || true)

    # Extract @yoopta/* workspace deps from package.json
    local yoopta_deps
    yoopta_deps=$(node -e "
        const pkg = require('$pkg_dir/package.json');
        const all = { ...pkg.dependencies, ...pkg.devDependencies };
        Object.entries(all)
            .filter(([k, v]) => k.startsWith('@yoopta/') && v.startsWith('workspace:'))
            .map(([k]) => k.replace('@yoopta/', ''))
            .forEach(n => console.log(n));
    " 2>/dev/null || true)

    # Recursively build @viben/* deps
    for dep in $viben_deps; do
        local dep_dir="$PACKAGES_DIR/$dep"
        if [ -d "$dep_dir" ]; then
            build_pkg "$dep_dir"
        fi
    done

    # Recursively build @yoopta/* deps (resolve from infra/Yoopta-Editor)
    for dep in $yoopta_deps; do
        local dep_dir=""
        # Try core/, plugins/, themes/ directories, and marks
        if [ -d "$YOOPTA_DIR/core/$dep" ]; then
            dep_dir="$YOOPTA_DIR/core/$dep"
        elif [ -d "$YOOPTA_DIR/plugins/$dep" ]; then
            dep_dir="$YOOPTA_DIR/plugins/$dep"
        elif [ -d "$YOOPTA_DIR/themes/$dep" ]; then
            dep_dir="$YOOPTA_DIR/themes/$dep"
        elif [ "$dep" = "marks" ] && [ -d "$YOOPTA_DIR/marks" ]; then
            dep_dir="$YOOPTA_DIR/marks"
        elif [ "$dep" = "themes-shadcn" ] && [ -d "$YOOPTA_DIR/themes/shadcn" ]; then
            dep_dir="$YOOPTA_DIR/themes/shadcn"
        fi
        if [ -n "$dep_dir" ]; then
            build_pkg "$dep_dir"
        fi
    done

    # Check if this package needs building:
    # - Has a "build" script in package.json
    # - main/module points to dist/ (i.e. not a source-only package)
    local has_build has_dist_export
    has_build=$(node -e "
        const pkg = require('$pkg_dir/package.json');
        console.log(pkg.scripts && pkg.scripts.build ? 'yes' : 'no');
    " 2>/dev/null || echo "no")

    has_dist_export=$(node -e "
        const pkg = require('$pkg_dir/package.json');
        const main = (pkg.main || '').replace(/^\.\//, '');
        const mod = (pkg.module || '').replace(/^\.\//, '');
        console.log((main.startsWith('dist/') || mod.startsWith('dist/')) ? 'yes' : 'no');
    " 2>/dev/null || echo "no")

    if [ "$has_build" = "yes" ] && [ "$has_dist_export" = "yes" ]; then
        # Determine display name based on package location
        local display_name="$pkg_name"
        case "$pkg_dir" in
            */infra/Yoopta-Editor/*) display_name="@yoopta/$pkg_name" ;;
            */packages/*) display_name="@viben/$pkg_name" ;;
        esac

        if $FORCE || [ ! -d "$pkg_dir/dist" ]; then
            echo "  📦 Building $display_name..."
            (cd "$pkg_dir" && pnpm build)
        else
            echo "  ✓ $display_name (dist/ exists)"
        fi
    fi
}

echo "📦 Checking workspace dependencies..."
build_pkg "$TARGET_DIR"
echo "✅ Dependencies ready"
