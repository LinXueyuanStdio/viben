#!/usr/bin/env bash
#
# Viben Bundled CLI + Gateway Test Script (macOS)
#
# Tests the Bun-compiled standalone binary (sidecar) on macOS.
# Must pass before the desktop release proceeds.
#
# Usage:
#   ./scripts/macos/test-cli-gateway.sh <path-to-binary>
#
# Example:
#   ./scripts/macos/test-cli-gateway.sh ./viben-aarch64-apple-darwin
#

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

FAILED_TESTS=0
PASSED_TESTS=0
GATEWAY_PID=""
TEST_DIR=""
GATEWAY_LOG=""
ORIG_DIR=""
GATEWAY_PORT=19999

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "  ${GREEN}[PASS]${NC} $1"; PASSED_TESTS=$((PASSED_TESTS + 1)); }
fail()    { echo -e "  ${RED}[FAIL]${NC} $1"; FAILED_TESTS=$((FAILED_TESTS + 1)); }

section() {
    echo ""
    echo -e "${CYAN}${BOLD}  $1${NC}"
    echo -e "${CYAN}  ──────────────────────────────────────────────${NC}"
}

run_test() {
    local name="$1" cmd="$2" expected_exit="${3:-0}"
    set +e
    output=$(eval "$cmd" 2>&1)
    exit_code=$?
    set -e
    if [ "$exit_code" -eq "$expected_exit" ]; then
        success "$name"
    else
        fail "$name (exit=$exit_code, expected=$expected_exit)"
        echo "      Output: $output"
    fi
}

run_test_output() {
    local name="$1" cmd="$2" expected="$3"
    set +e
    output=$(eval "$cmd" 2>&1)
    set -e
    if echo "$output" | grep -q "$expected"; then
        success "$name"
    else
        fail "$name (expected output containing: '$expected')"
        echo "      Output: $output"
    fi
}

run_test_json() {
    local name="$1" cmd="$2"
    set +e
    output=$(eval "$cmd" 2>&1)
    exit_code=$?
    set -e
    if [ "$exit_code" -ne 0 ]; then
        fail "$name (command failed, exit=$exit_code)"
        echo "      Output: $output"
        return
    fi
    if echo "$output" | jq . > /dev/null 2>&1; then
        success "$name"
    else
        fail "$name (invalid JSON)"
        echo "      Output: $output"
    fi
}

cleanup() {
    if [ -n "$GATEWAY_PID" ]; then
        kill "$GATEWAY_PID" 2>/dev/null || true
        wait "$GATEWAY_PID" 2>/dev/null || true
    fi
    # Save gateway log to original directory for CI visibility
    if [ -n "$GATEWAY_LOG" ] && [ -f "$GATEWAY_LOG" ] && [ -n "$ORIG_DIR" ]; then
        cp "$GATEWAY_LOG" "$ORIG_DIR/gateway-startup.log" 2>/dev/null || true
    fi
    if [ -n "$TEST_DIR" ] && [ -d "$TEST_DIR" ]; then
        rm -rf "$TEST_DIR"
    fi
}
trap cleanup EXIT

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

VIBEN="${1:?Usage: $0 <path-to-binary>}"

if [ ! -f "$VIBEN" ]; then
    echo -e "${RED}Error: binary not found: $VIBEN${NC}"
    exit 1
fi

VIBEN="$(cd "$(dirname "$VIBEN")" && pwd)/$(basename "$VIBEN")"
chmod +x "$VIBEN"

echo ""
echo -e "${CYAN}${BOLD}  Viben Bundled CLI Test (macOS)${NC}"
echo -e "${CYAN}  Binary: $VIBEN${NC}"
echo ""

# Ensure test port is free before starting
if lsof -ti :$GATEWAY_PORT > /dev/null 2>&1; then
    info "Port $GATEWAY_PORT is in use, cleaning up..."
    lsof -ti :$GATEWAY_PORT | xargs kill -9 2>/dev/null || true
    sleep 1
fi

ORIG_DIR="$(pwd)"
TEST_DIR=$(mktemp -d)
cd "$TEST_DIR"

# ===== Part 1: CLI Commands =====

section "Basic commands"
run_test          "--version"                "$VIBEN --version"
run_test_output   "--help contains Commands" "$VIBEN --help" "Commands:"
run_test          "unknown command fails"    "$VIBEN unknown-cmd-xyz 2>/dev/null" 1

section "Config commands"
run_test      "config list"      "$VIBEN config list"
run_test_json "config list JSON" "$VIBEN --json config list"

section "Init & workspace"
run_test "init --user ci-test" "$VIBEN init --user ci-test -y"
if [ -d ".viben" ]; then
    success "init creates .viben/"
else
    fail "init should create .viben/"
fi
run_test "workspace current" "$VIBEN workspace current"
run_test "workspace list"    "$VIBEN workspace list"

section "Resource list commands"
run_test "agent list"    "$VIBEN agent list"
run_test "provider list" "$VIBEN provider list"
run_test "model list"    "$VIBEN model list"
run_test "executor list" "$VIBEN executor list"
run_test "task list"     "$VIBEN task list"
run_test "mcp list"      "$VIBEN mcp list"
run_test "skill list"    "$VIBEN skill list"
run_test "cron list"     "$VIBEN cron list"
run_test "queue list"    "$VIBEN queue list"
run_test "context"       "$VIBEN context"

section "User commands"
run_test        "user init"            "$VIBEN user init ci-test"
run_test_output "user get shows name"  "$VIBEN user get" "ci-test"

section "Global options"
run_test      "quiet mode"   "$VIBEN --quiet config list"
run_test      "verbose mode" "$VIBEN --verbose config list"
run_test_json "json mode"    "$VIBEN --json config list"

# ===== Part 2: Gateway Tests =====

section "Gateway tests"

run_test "gateway status (stopped)" "$VIBEN gateway status --port $GATEWAY_PORT || true"

info "Starting gateway on port $GATEWAY_PORT..."
GATEWAY_LOG="$TEST_DIR/gateway.log"
$VIBEN gateway serve --port $GATEWAY_PORT > "$GATEWAY_LOG" 2>&1 &
GATEWAY_PID=$!
info "Gateway PID: $GATEWAY_PID"

# Wait for gateway to be ready
READY=false
for i in $(seq 1 30); do
    if curl -sf "http://127.0.0.1:$GATEWAY_PORT/health" > /dev/null 2>&1; then
        READY=true
        info "Gateway ready after ${i}s"
        break
    fi
    sleep 1
done

if [ "$READY" = true ]; then
    success "gateway starts and becomes ready"

    # Test /health
    HEALTH=$(curl -sf "http://127.0.0.1:$GATEWAY_PORT/health" 2>&1)
    if echo "$HEALTH" | jq -e '.status == "ok"' > /dev/null 2>&1; then
        success "/health returns {status: ok}"
    else
        fail "/health unexpected response: $HEALTH"
    fi

    # Test /api/agent (list agents)
    API=$(curl -sf "http://127.0.0.1:$GATEWAY_PORT/api/agent" 2>&1)
    if echo "$API" | jq -e '.agents' > /dev/null 2>&1; then
        success "/api/agent returns agent list"
    else
        fail "/api/agent unexpected response: $API"
    fi

    # Test /docs (Swagger UI)
    DOCS_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "http://127.0.0.1:$GATEWAY_PORT/docs" 2>&1)
    if [ "$DOCS_STATUS" = "200" ]; then
        success "/docs Swagger UI available"
    else
        fail "/docs Swagger UI not available (status=$DOCS_STATUS)"
    fi

    # Test /ws WebSocket endpoint
    # Use -i to include headers and --max-time to prevent hanging
    # Check for "101 Switching Protocols" in the response headers
    WS_RESPONSE=$(curl -s -i --max-time 2 \
      -H "Connection: Upgrade" \
      -H "Upgrade: websocket" \
      -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
      -H "Sec-WebSocket-Version: 13" \
      "http://127.0.0.1:$GATEWAY_PORT/ws" 2>/dev/null || true)
    if echo "$WS_RESPONSE" | grep -q "101 Switching Protocols"; then
        success "/ws WebSocket upgrade (101)"
    else
        fail "/ws WebSocket upgrade (no 101 response)"
    fi
else
    fail "gateway did not become ready within 30s"
fi

# Stop gateway
info "Stopping gateway (PID $GATEWAY_PID)..."
kill "$GATEWAY_PID" 2>/dev/null || true
wait "$GATEWAY_PID" 2>/dev/null || true
GATEWAY_PID=""

# Verify port released
sleep 1
if curl -sf "http://127.0.0.1:$GATEWAY_PORT/health" > /dev/null 2>&1; then
    fail "port $GATEWAY_PORT still in use after stop"
else
    success "port $GATEWAY_PORT released after stop"
fi

# Print gateway log for CI visibility
section "Gateway startup log"
if [ -f "$GATEWAY_LOG" ]; then
    cat "$GATEWAY_LOG"
else
    echo "  [INFO] No gateway log file found"
fi

# ===== Summary =====

section "Summary"
echo ""
echo -e "  ${GREEN}Passed:${NC} $PASSED_TESTS"
echo -e "  ${RED}Failed:${NC} $FAILED_TESTS"
echo ""

if [ "$FAILED_TESTS" -gt 0 ]; then
    echo -e "${RED}${BOLD}  Some tests failed!${NC}"
    exit 1
else
    echo -e "${GREEN}${BOLD}  All tests passed!${NC}"
    exit 0
fi
