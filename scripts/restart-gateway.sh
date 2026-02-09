#!/bin/bash
# Restart Viben Gateway (Debug Mode)
#
# Always rebuilds and runs in debug mode for development.
#
# Usage: ./scripts/restart-gateway.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CRATES_DIR="$PROJECT_ROOT/crates"
BINARY="$CRATES_DIR/target/debug/viben"

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
PORT=18790
if lsof -i :$PORT > /dev/null 2>&1; then
    echo -e "${RED}Port $PORT is still in use, killing process...${NC}"
    lsof -ti :$PORT | xargs kill -9 2>/dev/null || true
    sleep 1
fi

# Start gateway
echo -e "${YELLOW}Starting gateway on port $PORT...${NC}"
"$BINARY" gateway start &
GATEWAY_PID=$!

# Wait for startup
sleep 2

# Health check (bypass proxy)
if curl -s --noproxy localhost "http://127.0.0.1:$PORT/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Gateway started successfully (PID: $GATEWAY_PID)${NC}"
    echo -e "${GREEN}  Health: http://127.0.0.1:$PORT/health${NC}"
    echo -e "${GREEN}  API: http://127.0.0.1:$PORT/api${NC}"
    echo -e "${CYAN}  Mode: DEBUG${NC}"
else
    echo -e "${RED}✗ Gateway failed to start${NC}"
    exit 1
fi
