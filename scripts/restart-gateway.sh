#!/bin/bash
# Restart Viben Gateway (Node.js - packages/core)
#
# Starts the Node.js gateway from packages/core for development.
# All operations are logged with timestamps.
#
# Usage: ./scripts/restart-gateway.sh
#
# Log files (in ~/.viben/logs/):
#   gateway.log          - Gateway runtime output
#   gateway-restart.log  - Restart script operations log

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$HOME/.viben/logs"
RUNTIME_LOG="$LOG_DIR/gateway.log"
RESTART_LOG="$LOG_DIR/gateway-restart.log"
PORT=18790
MAX_LOG_SIZE=$((10 * 1024 * 1024))  # 10MB

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Log function - writes to both console and log file
log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local color=""

    case "$level" in
        INFO)  color="${GREEN}" ;;
        WARN)  color="${YELLOW}" ;;
        ERROR) color="${RED}" ;;
        DEBUG) color="${CYAN}" ;;
        *)     color="${NC}" ;;
    esac

    # Console output with color
    echo -e "${color}[$timestamp] [$level] $message${NC}"

    # Log file output without color
    echo "[$timestamp] [$level] $message" >> "$RESTART_LOG"
}

# Rotate log file if too large
rotate_log() {
    local log_file="$1"
    if [ -f "$log_file" ] && [ $(stat -f%z "$log_file" 2>/dev/null || stat -c%s "$log_file" 2>/dev/null || echo 0) -gt $MAX_LOG_SIZE ]; then
        local backup="${log_file}.old"
        mv "$log_file" "$backup"
        log "INFO" "Rotated log file: $log_file -> $backup"
    fi
}

# Get system info for logging
log_system_info() {
    log "DEBUG" "System: $(uname -s) $(uname -r)"
    log "DEBUG" "Node version: $(node --version 2>/dev/null || echo 'not found')"
    log "DEBUG" "Working directory: $PROJECT_ROOT"
}

# Check if port is in use and get process info
check_port() {
    local port="$1"
    if lsof -i :$port > /dev/null 2>&1; then
        local pids=$(lsof -ti :$port 2>/dev/null || true)
        local process_info=$(lsof -i :$port 2>/dev/null | tail -n +2 || true)
        log "WARN" "Port $port is in use by PIDs: $pids"
        log "DEBUG" "Process info:\n$process_info"
        return 0
    fi
    return 1
}

# Kill processes safely
kill_processes() {
    local pattern="$1"
    local pids=$(pgrep -f "$pattern" 2>/dev/null || true)
    if [ -n "$pids" ]; then
        log "INFO" "Killing processes matching '$pattern': $pids"
        pkill -f "$pattern" 2>/dev/null || true
        return 0
    fi
    return 1
}

# ============================================================
# Main Script
# ============================================================

# Rotate logs if needed
rotate_log "$RESTART_LOG"
rotate_log "$RUNTIME_LOG"

# Start new session
echo "" >> "$RESTART_LOG"
log "INFO" "=========================================="
log "INFO" "=== Viben Gateway Restart Started ==="
log "INFO" "=========================================="

# Log system information
log_system_info

# Kill existing gateway processes
log "INFO" "Stopping existing gateway processes..."
kill_processes "viben.*gateway" && sleep 0.5 || log "DEBUG" "No viben gateway process found"
kill_processes "node.*gateway.*start" && sleep 0.5 || log "DEBUG" "No node gateway process found"
sleep 1

# Verify port is free
if check_port $PORT; then
    log "WARN" "Port $PORT is still in use, force killing..."
    pids=$(lsof -ti :$PORT 2>/dev/null || true)
    if [ -n "$pids" ]; then
        for pid in $pids; do
            log "INFO" "Killing PID $pid on port $PORT"
            kill -9 "$pid" 2>/dev/null || true
        done
    fi
    sleep 1

    # Verify again
    if check_port $PORT; then
        log "ERROR" "Failed to free port $PORT"
        exit 1
    fi
fi

log "INFO" "Port $PORT is free"

# Change to packages/core directory
cd "$PROJECT_ROOT/packages/core"
log "DEBUG" "Changed to directory: $(pwd)"

# Check if CLI binary exists
if [ ! -f "./dist/cli/bin.js" ]; then
    log "ERROR" "CLI binary not found: ./dist/cli/bin.js"
    log "ERROR" "Please run 'pnpm build' in packages/core first"
    exit 1
fi

# Start gateway
log "INFO" "Starting Node.js gateway on port $PORT..."
log "DEBUG" "Command: node ./dist/cli/bin.js gateway start --daemon --port $PORT"

# Clear previous runtime log and start gateway
echo "" > "$RUNTIME_LOG"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Gateway starting..." >> "$RUNTIME_LOG"

node ./dist/cli/bin.js gateway start --daemon --port $PORT >> "$RUNTIME_LOG" 2>&1 &
START_CMD_PID=$!
log "DEBUG" "Start command PID: $START_CMD_PID"

# Wait for startup with retry
log "INFO" "Waiting for gateway to start..."
MAX_RETRIES=15
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    sleep 1

    # Check health endpoint
    if curl -s --noproxy '*' --connect-timeout 2 "http://127.0.0.1:$PORT/health" > /dev/null 2>&1; then
        GATEWAY_PID=$(lsof -ti :$PORT 2>/dev/null | head -1)

        log "INFO" "=========================================="
        log "INFO" "Gateway started successfully!"
        log "INFO" "=========================================="
        log "INFO" "PID: $GATEWAY_PID"
        log "INFO" "Health: http://127.0.0.1:$PORT/health"
        log "INFO" "API: http://127.0.0.1:$PORT/api"
        log "INFO" "Runtime Log: $RUNTIME_LOG"
        log "INFO" "Restart Log: $RESTART_LOG"

        # Log health check response
        HEALTH_RESPONSE=$(curl -s --noproxy '*' "http://127.0.0.1:$PORT/health" 2>/dev/null || echo "failed")
        log "DEBUG" "Health response: $HEALTH_RESPONSE"

        exit 0
    fi

    RETRY_COUNT=$((RETRY_COUNT + 1))
    log "DEBUG" "Retry $RETRY_COUNT/$MAX_RETRIES - waiting for gateway..."
done

# Failed to start
log "ERROR" "=========================================="
log "ERROR" "Gateway failed to start after $MAX_RETRIES retries"
log "ERROR" "=========================================="

# Log diagnostics
log "ERROR" "Diagnostics:"

# Check if process is still running
if [ -n "$START_CMD_PID" ] && kill -0 "$START_CMD_PID" 2>/dev/null; then
    log "DEBUG" "Start command process is still running (PID: $START_CMD_PID)"
else
    log "ERROR" "Start command process has exited"
fi

# Check port status
if check_port $PORT; then
    log "DEBUG" "Something is listening on port $PORT but not responding to health check"
else
    log "ERROR" "Nothing is listening on port $PORT"
fi

# Show last log lines
log "ERROR" "Last 50 lines of runtime log:"
echo "--- Runtime Log Start ---" >> "$RESTART_LOG"
tail -50 "$RUNTIME_LOG" 2>/dev/null | tee -a "$RESTART_LOG" || echo "(no log output)"
echo "--- Runtime Log End ---" >> "$RESTART_LOG"

exit 1
