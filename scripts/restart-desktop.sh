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
