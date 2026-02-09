#!/bin/bash
# Restart Viben Gateway
#
# Usage: ./scripts/restart-gateway.sh [--build]
#
# Options:
#   --build   Rebuild viben-core before restarting

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CRATES_DIR="$PROJECT_ROOT/crates"
BINARY="$CRATES_DIR/target/release/viben"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Viben Gateway Restart ===${NC}"

# Parse arguments
BUILD=false
for arg in "$@"; do
    case $arg in
        --build)
            BUILD=true
            shift
            ;;
    esac
done

# Build if requested or binary doesn't exist
if [ "$BUILD" = true ] || [ ! -f "$BINARY" ]; then
    echo -e "${YELLOW}Building viben-core...${NC}"
    cd "$CRATES_DIR"
    cargo build -p viben-core --bin viben --release
    echo -e "${GREEN}Build complete${NC}"
fi

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

# Health check
if curl -s "http://127.0.0.1:$PORT/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Gateway started successfully (PID: $GATEWAY_PID)${NC}"
    echo -e "${GREEN}  Health: http://127.0.0.1:$PORT/health${NC}"
    echo -e "${GREEN}  API: http://127.0.0.1:$PORT/api${NC}"
else
    echo -e "${RED}✗ Gateway failed to start${NC}"
    exit 1
fi
