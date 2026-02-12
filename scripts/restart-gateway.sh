#!/bin/bash
# Restart Viben Gateway (Node.js - packages/core)
#
# Starts the Node.js gateway from packages/core for development.
#
# Usage: ./scripts/restart-gateway.sh
#
# Options:
#   --rust    Use Rust gateway instead (crates/viben-core)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$PROJECT_ROOT/.gateway.log"
PORT=18790

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Check for --rust flag
USE_RUST=false
for arg in "$@"; do
    if [ "$arg" = "--rust" ]; then
        USE_RUST=true
        break
    fi
done

echo -e "${YELLOW}=== Viben Gateway Restart ===${NC}"

# Kill existing gateway processes
echo -e "${YELLOW}Stopping existing gateway...${NC}"
pkill -f "viben.*gateway" 2>/dev/null || true
pkill -f "node.*gateway" 2>/dev/null || true
sleep 1

# Verify port is free
if lsof -i :$PORT > /dev/null 2>&1; then
    echo -e "${RED}Port $PORT is still in use, killing process...${NC}"
    lsof -ti :$PORT | xargs kill -9 2>/dev/null || true
    sleep 1
fi

if [ "$USE_RUST" = true ]; then
    # === Rust Gateway ===
    export RUST_LOG="${RUST_LOG:-info}"
    BINARY="$PROJECT_ROOT/target/debug/viben"

    echo -e "${CYAN}Building Rust gateway (debug)...${NC}"
    cd "$PROJECT_ROOT"
    cargo build -p viben-core --bin viben
    echo -e "${GREEN}Build complete${NC}"

    echo -e "${YELLOW}Starting Rust gateway on port $PORT (RUST_LOG=$RUST_LOG)...${NC}"
    "$BINARY" gateway start > "$LOG_FILE" 2>&1 &
    GATEWAY_PID=$!
else
    # === Node.js Gateway (packages/core CLI) ===
    cd "$PROJECT_ROOT/packages/core"

    echo -e "${YELLOW}Starting Node.js gateway on port $PORT...${NC}"
    # Use viben CLI directly from dist
    node ./dist/cli/bin.js gateway start --daemon --port $PORT > "$LOG_FILE" 2>&1
    # Get the daemon PID from the output
    GATEWAY_PID=$(lsof -ti :$PORT 2>/dev/null | head -1)
fi

# Wait for startup with retry
echo -e "${CYAN}Waiting for gateway to start...${NC}"
MAX_RETRIES=15
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    sleep 1
    if curl -s --noproxy '*' "http://127.0.0.1:$PORT/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Gateway started successfully (PID: $GATEWAY_PID)${NC}"
        echo -e "${GREEN}  Health: http://127.0.0.1:$PORT/health${NC}"
        echo -e "${GREEN}  API: http://127.0.0.1:$PORT/api${NC}"
        if [ "$USE_RUST" = true ]; then
            echo -e "${CYAN}  Mode: Rust (DEBUG)${NC}"
        else
            echo -e "${CYAN}  Mode: Node.js (packages/core)${NC}"
        fi
        echo -e "${CYAN}  Log: $LOG_FILE${NC}"
        exit 0
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo -e "${YELLOW}  Retry $RETRY_COUNT/$MAX_RETRIES...${NC}"
done

# Failed - show last log lines
echo -e "${RED}✗ Gateway failed to start${NC}"
echo -e "${RED}Last log output:${NC}"
tail -30 "$LOG_FILE" 2>/dev/null || echo "(no log output)"
exit 1
