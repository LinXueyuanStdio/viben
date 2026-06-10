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
OS=$(uname -s)

EXE_SUFFIX=""
case "$OS" in
    Darwin)
        case "$ARCH" in
            x86_64)        TARGET_TRIPLE="x86_64-apple-darwin" ;;
            aarch64|arm64) TARGET_TRIPLE="aarch64-apple-darwin" ;;
            *)             TARGET_TRIPLE="$ARCH-apple-darwin" ;;
        esac
        ;;
    Linux)
        case "$ARCH" in
            x86_64)        TARGET_TRIPLE="x86_64-unknown-linux-gnu" ;;
            aarch64|arm64) TARGET_TRIPLE="aarch64-unknown-linux-gnu" ;;
            *)             TARGET_TRIPLE="$ARCH-unknown-linux-gnu" ;;
        esac
        ;;
    MINGW*|MSYS*|CYGWIN*)
        EXE_SUFFIX=".exe"
        case "$ARCH" in
            x86_64|AMD64)  TARGET_TRIPLE="x86_64-pc-windows-msvc" ;;
            aarch64|arm64) TARGET_TRIPLE="aarch64-pc-windows-msvc" ;;
            *)             TARGET_TRIPLE="$ARCH-pc-windows-msvc" ;;
        esac
        ;;
    *)
        TARGET_TRIPLE="$ARCH-unknown-linux-gnu"
        ;;
esac

SIDECAR_BIN="$SIDECAR_DIR/viben-${TARGET_TRIPLE}${EXE_SUFFIX}"

if [ ! -f "$SIDECAR_BIN" ]; then
    echo "📦 Building sidecar binary (viben-$TARGET_TRIPLE)..."
    (cd "$ROOT_DIR" && pnpm --filter @viben/core build:sidecar)
else
    echo "✓ Sidecar binary exists: viben-$TARGET_TRIPLE"
fi

# --- Kill existing processes ---
echo ""
echo "🔄 Restarting Viben Desktop..."

kill_with_info() {
    local pattern="$1"
    local description="$2"
    local pids
    pids=$(pgrep -f "$pattern" 2>/dev/null || true)
    if [ -n "$pids" ]; then
        echo "  Killing $description:"
        for pid in $pids; do
            local cmdline
            cmdline=$(ps -p "$pid" -o args= 2>/dev/null || echo "[unknown]")
            echo "    PID $pid: $cmdline"
            kill -9 "$pid" 2>/dev/null || true
        done
    fi
}

echo "  Checking port 1549..."
PORT_PIDS=$(lsof -ti:1549 2>/dev/null || true)
if [ -n "$PORT_PIDS" ]; then
    echo "  Killing processes on port 1549:"
    for pid in $PORT_PIDS; do
        cmdline=$(ps -p "$pid" -o args= 2>/dev/null || echo "[unknown]")
        echo "    PID $pid: $cmdline"
        kill -9 "$pid" 2>/dev/null || true
    done
fi

kill_with_info "^viben-desktop$" "viben-desktop Tauri binary"
kill_with_info "vite.*apps/desktop" "Vite dev server (apps/desktop)"
kill_with_info "tauri dev" "Tauri dev process"
kill_with_info "cargo-tauri" "cargo-tauri process"

sleep 1

if lsof -i:1549 > /dev/null 2>&1; then
  echo "❌ Error: Port 1549 is still in use"
  exit 1
fi

echo "✅ All processes killed, port 1549 is free"

# --- Start Tauri dev ---
echo "🚀 Starting Tauri desktop..."
cd "$ROOT_DIR/apps/desktop"
pnpm tauri dev
