#!/bin/bash
# Restart Desktop App Script
#
# Automatically builds workspace dependencies if dist/ is missing,
# kills all related processes, and restarts Tauri desktop.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# --- Auto-build workspace dependencies ---
echo "📦 Checking workspace dependencies..."
"$SCRIPT_DIR/build-deps.sh" "$ROOT_DIR/apps/desktop"

# --- Auto-build sidecar binary ---
SIDECAR_DIR="$ROOT_DIR/apps/desktop/src-tauri/binaries"
ARCH=$(uname -m)
case "$ARCH" in
    x86_64)  TARGET_TRIPLE="x86_64-unknown-linux-gnu" ;;
    aarch64) TARGET_TRIPLE="aarch64-unknown-linux-gnu" ;;
    arm64)   TARGET_TRIPLE="aarch64-apple-darwin" ;;
    *)       TARGET_TRIPLE="$ARCH-unknown-linux-gnu" ;;
esac

# macOS detection
if [ "$(uname -s)" = "Darwin" ]; then
    case "$ARCH" in
        x86_64)  TARGET_TRIPLE="x86_64-apple-darwin" ;;
        arm64)   TARGET_TRIPLE="aarch64-apple-darwin" ;;
    esac
fi

SIDECAR_BIN="$SIDECAR_DIR/viben-$TARGET_TRIPLE"

if [ ! -f "$SIDECAR_BIN" ]; then
    echo "📦 Building sidecar binary (viben-$TARGET_TRIPLE)..."
    (cd "$ROOT_DIR" && pnpm --filter @viben/core build:sidecar)
else
    echo "✓ Sidecar binary exists: viben-$TARGET_TRIPLE"
fi

# --- Kill existing processes ---
echo ""
echo "🔄 Restarting Viben Desktop..."

echo "  Killing processes on port 1420..."
lsof -ti:1420 | xargs kill -9 2>/dev/null || true

echo "  Killing viben-desktop Tauri processes..."
pkill -9 -f "viben-desktop" 2>/dev/null || true

echo "  Killing desktop-related Vite/Tauri processes..."
pkill -9 -f "apps/desktop.*vite" 2>/dev/null || true
pkill -9 -f "tauri.*apps/desktop" 2>/dev/null || true
pkill -9 -f "cargo.*viben-desktop" 2>/dev/null || true

sleep 1

if lsof -i:1420 > /dev/null 2>&1; then
  echo "❌ Error: Port 1420 is still in use"
  exit 1
fi

echo "✅ All processes killed, port 1420 is free"

# --- Start Tauri dev ---
echo "🚀 Starting Tauri desktop..."
cd "$ROOT_DIR/apps/desktop"
pnpm tauri dev
