#!/bin/bash
# Restart Viben Gateway (Debug Mode)
#
# Always rebuilds and runs in debug mode for development.
#
# Usage: ./scripts/restart-gateway.sh
#
# Environment:
#   RUST_LOG - Log level (default: info)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CRATES_DIR="$PROJECT_ROOT/crates"
BINARY="$CRATES_DIR/target/debug/viben"
LOG_FILE="$PROJECT_ROOT/.gateway.log"
PORT=18790

# Default log level
export RUST_LOG="${RUST_LOG:-info}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Viben Gateway Restart (Debug) ===${NC}"

# Always build in debug mode
echo -e "${CYAN}Building viben (debug)...${NC}"
cd "$CRATES_DIR"
cargo build -p viben-core --bin viben
echo -e "${GREEN}Build complete${NC}"

# Kill existing gateway processes
echo -e "${YELLOW}Stopping existing gateway...${NC}"
pkill -f "viben.*gateway" 2>/dev/null || true
sleep 1

# Verify port is free
if lsof -i :$PORT > /dev/null 2>&1; then
    echo -e "${RED}Port $PORT is still in use, killing process...${NC}"
    lsof -ti :$PORT | xargs kill -9 2>/dev/null || true
    sleep 1
fi

# Start gateway with logging
echo -e "${YELLOW}Starting gateway on port $PORT (RUST_LOG=$RUST_LOG)...${NC}"
"$BINARY" gateway start > "$LOG_FILE" 2>&1 &
GATEWAY_PID=$!

# Wait for startup with retry
echo -e "${CYAN}Waiting for gateway to start...${NC}"
MAX_RETRIES=10
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    sleep 1
    if curl -s --noproxy '*' "http://127.0.0.1:$PORT/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Gateway started successfully (PID: $GATEWAY_PID)${NC}"
        echo -e "${GREEN}  Health: http://127.0.0.1:$PORT/health${NC}"
        echo -e "${GREEN}  API: http://127.0.0.1:$PORT/api${NC}"
        echo -e "${CYAN}  Mode: DEBUG${NC}"
        echo -e "${CYAN}  Log: $LOG_FILE${NC}"
        exit 0
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo -e "${YELLOW}  Retry $RETRY_COUNT/$MAX_RETRIES...${NC}"
done

# Failed - show last log lines
echo -e "${RED}✗ Gateway failed to start${NC}"
echo -e "${RED}Last log output:${NC}"
tail -20 "$LOG_FILE" 2>/dev/null || echo "(no log output)"
exit 1
