#!/bin/bash
# Restart Desktop App Script
# Kills all related processes and restarts Tauri desktop

set -e

echo "🔄 Restarting Viben Desktop..."

# Kill processes on port 1420 (Vite dev server)
echo "  Killing processes on port 1420..."
lsof -ti:1420 | xargs kill -9 2>/dev/null || true

# Kill Tauri processes
echo "  Killing Tauri processes..."
pkill -9 -f "tauri" 2>/dev/null || true

# Kill Vite processes
echo "  Killing Vite processes..."
pkill -9 -f "vite" 2>/dev/null || true

# Kill viben-desktop processes
echo "  Killing viben-desktop processes..."
pkill -9 -f "viben-desktop" 2>/dev/null || true

# Wait for processes to fully terminate
sleep 2

# Verify port is free
if lsof -i:1420 > /dev/null 2>&1; then
  echo "❌ Error: Port 1420 is still in use"
  exit 1
fi

echo "✅ All processes killed, port 1420 is free"

# Start Tauri dev
echo "🚀 Starting Tauri desktop..."
cd "$(dirname "$0")/../apps/desktop"
pnpm tauri dev
