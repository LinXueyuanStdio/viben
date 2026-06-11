#!/usr/bin/env bash
# E2E MCP-to-Page Client Test
#
# Tests the full path: MCP Client → HTTP → GUI_execute → Socket.io → Page Client
#
# Orchestrates:
#   1. Starts mcp-to-page (which starts gateway on port 18791)
#   2. Waits for gateway health check
#   3. Starts page-client (connects to gateway, registers actions)
#   4. MCP test detects page-client, runs MCP tool calls, asserts results
#   5. Reports overall result
#
# Usage: bash scripts/e2e-mcp-test.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TEST_PORT=18791
TEST_HOST="127.0.0.1"
HEALTH_URL="http://${TEST_HOST}:${TEST_PORT}/health"
MAX_HEALTH_WAIT=10

MCP_PID=""
PAGE_PID=""

cleanup() {
  echo ""
  echo "[test] Cleaning up..."
  if [[ -n "$PAGE_PID" ]] && kill -0 "$PAGE_PID" 2>/dev/null; then
    kill "$PAGE_PID" 2>/dev/null || true
    wait "$PAGE_PID" 2>/dev/null || true
  fi
  if [[ -n "$MCP_PID" ]] && kill -0 "$MCP_PID" 2>/dev/null; then
    kill "$MCP_PID" 2>/dev/null || true
    wait "$MCP_PID" 2>/dev/null || true
  fi
  lsof -ti:${TEST_PORT} 2>/dev/null | xargs -r kill 2>/dev/null || true
}

trap cleanup EXIT

echo "============================================"
echo "  E2E MCP → Page Client Communication Test"
echo "============================================"
echo ""
echo "  Path: MCP Client (SDK)"
echo "      → POST /api/mcp-server/gui-action"
echo "      → GUI_execute tool"
echo "      → ClientSocketServer.executeAction"
echo "      → Socket.io → Page Client"
echo ""

# Check if port is available
if lsof -ti:${TEST_PORT} >/dev/null 2>&1; then
  echo "[test] ERROR: Port ${TEST_PORT} is already in use"
  exit 1
fi

# Step 1: Start MCP test (starts gateway internally)
echo "[test] Step 1: Starting MCP test gateway on :${TEST_PORT}..."
cd "$CORE_DIR"
npx tsx scripts/e2e-mcp-to-page.ts &
MCP_PID=$!
echo "[test]   PID: $MCP_PID"

# Step 2: Wait for gateway health
echo "[test] Step 2: Waiting for gateway health..."
HEALTH_OK=false
for i in $(seq 1 $MAX_HEALTH_WAIT); do
  if curl -sf "$HEALTH_URL" >/dev/null 2>&1; then
    HEALTH_OK=true
    echo "[test]   Gateway healthy after ${i}s"
    break
  fi
  sleep 1
done

if [[ "$HEALTH_OK" != "true" ]]; then
  echo "[test] ERROR: Gateway did not become healthy within ${MAX_HEALTH_WAIT}s"
  exit 1
fi

# Step 3: Start page-client
echo "[test] Step 3: Starting page-client..."
npx tsx scripts/e2e-page-client.ts "http://${TEST_HOST}:${TEST_PORT}" &
PAGE_PID=$!
echo "[test]   PID: $PAGE_PID"

# Step 4: Wait for MCP test to complete
echo "[test] Step 4: Waiting for MCP test to complete assertions..."
MCP_EXIT=0
wait "$MCP_PID" || MCP_EXIT=$?
MCP_PID=""

# Step 5: Report results
echo ""
echo "============================================"
if [[ $MCP_EXIT -eq 0 ]]; then
  echo "  ✅ ALL MCP E2E TESTS PASSED"
else
  echo "  ❌ MCP E2E TESTS FAILED (exit code: $MCP_EXIT)"
fi
echo "============================================"

exit $MCP_EXIT
