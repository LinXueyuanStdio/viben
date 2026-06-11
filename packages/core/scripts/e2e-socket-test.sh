#!/usr/bin/env bash
# E2E Socket.io Client Communication Test
#
# Orchestrates:
#   1. Starts main-client (which starts gateway on port 18791)
#   2. Waits for gateway health check
#   3. Starts page-client (connects to gateway, registers actions)
#   4. Main-client detects page-client, runs assertions, exits
#   5. Reports overall result
#
# Usage: bash scripts/e2e-socket-test.sh
#   or:  cd packages/core && bash scripts/e2e-socket-test.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TEST_PORT=18791
TEST_HOST="127.0.0.1"
HEALTH_URL="http://${TEST_HOST}:${TEST_PORT}/health"
MAX_HEALTH_WAIT=10

MAIN_PID=""
PAGE_PID=""

cleanup() {
  echo ""
  echo "[test] Cleaning up..."
  if [[ -n "$PAGE_PID" ]] && kill -0 "$PAGE_PID" 2>/dev/null; then
    kill "$PAGE_PID" 2>/dev/null || true
    wait "$PAGE_PID" 2>/dev/null || true
  fi
  if [[ -n "$MAIN_PID" ]] && kill -0 "$MAIN_PID" 2>/dev/null; then
    kill "$MAIN_PID" 2>/dev/null || true
    wait "$MAIN_PID" 2>/dev/null || true
  fi
  # Kill anything still on the test port
  lsof -ti:${TEST_PORT} 2>/dev/null | xargs -r kill 2>/dev/null || true
}

trap cleanup EXIT

echo "============================================"
echo "  E2E Socket.io Client Communication Test"
echo "============================================"
echo ""

# Check if port is available
if lsof -ti:${TEST_PORT} >/dev/null 2>&1; then
  echo "[test] ERROR: Port ${TEST_PORT} is already in use"
  exit 1
fi

# Step 1: Start main-client (gateway)
echo "[test] Step 1: Starting main-client (gateway on :${TEST_PORT})..."
cd "$CORE_DIR"
npx tsx scripts/e2e-main-client.ts &
MAIN_PID=$!
echo "[test]   PID: $MAIN_PID"

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

# Step 4: Wait for main-client to complete assertions
echo "[test] Step 4: Waiting for main-client to complete assertions..."
MAIN_EXIT=0
wait "$MAIN_PID" || MAIN_EXIT=$?
MAIN_PID=""

# Step 5: Report results
echo ""
echo "============================================"
if [[ $MAIN_EXIT -eq 0 ]]; then
  echo "  ✅ ALL TESTS PASSED"
else
  echo "  ❌ TESTS FAILED (exit code: $MAIN_EXIT)"
fi
echo "============================================"

exit $MAIN_EXIT
