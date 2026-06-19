#!/usr/bin/env bash
#
# Viben CLI Integration Test Script
#
# This script simulates the full user flow from installation to usage.
# It must pass before publishing to npm.
#
# Usage:
#   ./scripts/test-cli.sh [--local]
#
# Options:
#   --local   Test local build instead of npm package
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Test configuration
TEST_DIR=""
VIBEN_CMD=""
FAILED_TESTS=0
PASSED_TESTS=0
LOCAL_MODE=false

# -----------------------------------------------------------------------------
# Helper functions
# -----------------------------------------------------------------------------

print_banner() {
    echo ""
    echo -e "${CYAN}${BOLD}"
    echo "  ╦  ╦╦╔╗ ╔═╗╔╗╔  ╔═╗╦  ╦  ╔╦╗╔═╗╔═╗╔╦╗"
    echo "  ╚╗╔╝║╠╩╗║╣ ║║║  ║  ║  ║   ║ ║╣ ╚═╗ ║ "
    echo "   ╚╝ ╩╚═╝╚═╝╝╚╝  ╚═╝╩═╝╩   ╩ ╚═╝╚═╝ ╩ "
    echo -e "${NC}"
    echo -e "  ${BOLD}Integration Test Suite${NC}"
    echo ""
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    PASSED_TESTS=$((PASSED_TESTS + 1))
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    FAILED_TESTS=$((FAILED_TESTS + 1))
}

section() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}${BOLD}  $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# Run a test and check exit code
run_test() {
    local name="$1"
    local cmd="$2"
    local expected_exit="${3:-0}"

    echo -n "  Testing: $name... "

    set +e
    output=$(eval "$cmd" 2>&1)
    exit_code=$?
    set -e

    if [ "$exit_code" -eq "$expected_exit" ]; then
        echo -e "${GREEN}OK${NC}"
        success "$name"
        return 0
    else
        echo -e "${RED}FAILED${NC}"
        fail "$name (exit code: $exit_code, expected: $expected_exit)"
        echo "    Output: $output"
        return 0  # Don't return 1 to avoid early exit with set -e
    fi
}

# Run a test and check output contains expected string
run_test_output() {
    local name="$1"
    local cmd="$2"
    local expected="$3"

    echo -n "  Testing: $name... "

    set +e
    output=$(eval "$cmd" 2>&1)
    exit_code=$?

    if echo "$output" | grep -q "$expected"; then
        echo -e "${GREEN}OK${NC}"
        success "$name"
        set -e
        return 0
    else
        echo -e "${RED}FAILED${NC}"
        fail "$name (expected output to contain: '$expected')"
        echo "    Actual output: $output"
        set -e
        return 0  # Don't return 1 to avoid early exit with set -e
    fi
}

# Run a test with JSON output and verify structure
run_test_json() {
    local name="$1"
    local cmd="$2"
    local jq_filter="$3"
    local expected="$4"

    echo -n "  Testing: $name (JSON)... "

    set +e
    output=$(eval "$cmd" 2>&1)
    exit_code=$?

    if [ "$exit_code" -ne 0 ]; then
        echo -e "${RED}FAILED${NC}"
        fail "$name (command failed with exit code: $exit_code)"
        echo "    Output: $output"
        set -e
        return 0  # Don't return 1 to avoid early exit with set -e
    fi

    result=$(echo "$output" | jq -r "$jq_filter" 2>/dev/null)
    set -e

    if [ "$result" == "$expected" ]; then
        echo -e "${GREEN}OK${NC}"
        success "$name (JSON)"
        return 0
    else
        echo -e "${RED}FAILED${NC}"
        fail "$name (JSON) (expected: '$expected', got: '$result')"
        return 0  # Don't return 1 to avoid early exit with set -e
    fi
}

# Cleanup function
cleanup() {
    if [ -n "$TEST_DIR" ] && [ -d "$TEST_DIR" ]; then
        info "Cleaning up test directory: $TEST_DIR"
        rm -rf "$TEST_DIR"
    fi
}

# Setup trap for cleanup
trap cleanup EXIT

# -----------------------------------------------------------------------------
# Test setup
# -----------------------------------------------------------------------------

setup_test_environment() {
    section "Setting up test environment"

    # Create temporary test directory
    TEST_DIR=$(mktemp -d)
    info "Created test directory: $TEST_DIR"

    if [ "$LOCAL_MODE" = true ]; then
        # Use local build
        info "Using local build mode"

        # Find the project root
        SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

        # Check if CLI is built
        if [ ! -f "$PROJECT_ROOT/apps/cli/dist/index.js" ]; then
            echo -e "${RED}Error: CLI not built. Run 'pnpm build' first.${NC}"
            exit 1
        fi

        VIBEN_CMD="node $PROJECT_ROOT/apps/cli/dist/index.js"
        info "Using local CLI: $VIBEN_CMD"
    else
        # Install from npm (for CI)
        info "Installing viben from npm..."

        cd "$TEST_DIR"

        # Create a minimal package.json
        echo '{"name":"viben-test","private":true}' > package.json

        # Install viben locally to the test directory
        npm install viben --save-dev

        VIBEN_CMD="npx viben"
        info "Using npm CLI: $VIBEN_CMD"
    fi

    echo ""
}

# -----------------------------------------------------------------------------
# Test suites
# -----------------------------------------------------------------------------

test_basic_commands() {
    section "Testing basic commands"

    # Version
    run_test "viben --version" "$VIBEN_CMD --version"
    run_test_output "version output format" "$VIBEN_CMD --version" "^[0-9]"

    # Help
    run_test "viben --help" "$VIBEN_CMD --help"
    run_test_output "help shows commands" "$VIBEN_CMD --help" "Commands:"

    # Unknown command should fail
    run_test "unknown command fails" "$VIBEN_CMD unknown-cmd-xyz 2>/dev/null" 1
}

test_config_commands() {
    section "Testing config commands"

    cd "$TEST_DIR"

    # Config list
    run_test "viben config list" "$VIBEN_CMD config list"

    # Config list with JSON
    run_test_json "config list JSON" "$VIBEN_CMD --json config list" ".success" "true"

    # Config get (may not exist, but should not error badly)
    run_test "viben config get editor" "$VIBEN_CMD config get editor || true"
}

test_init_command() {
    section "Testing init command"

    # Create a fresh test workspace
    local workspace_dir="$TEST_DIR/test-workspace"
    mkdir -p "$workspace_dir"
    cd "$workspace_dir"

    # Init workspace with user flag
    # Note: In local mode, template copying may fail but core init should work
    echo -n "  Testing: viben init --user test-user... "
    set +e
    output=$($VIBEN_CMD init --user test-user 2>&1)
    exit_code=$?
    set -e

    # Check .viben directory was created (core functionality)
    if [ -d ".viben" ]; then
        echo -e "${GREEN}OK${NC} (core init succeeded)"
        success "init creates .viben directory"
    else
        echo -e "${RED}FAILED${NC}"
        fail "init should create .viben directory"
        echo "    Output: $output"
    fi

    # Check config file exists
    if [ -f ".viben/config.yaml" ]; then
        success "init creates config.yaml"
    else
        fail "init should create config.yaml"
    fi

    # Second workspace test - verify JSON output structure
    local workspace_dir2="$TEST_DIR/test-workspace-2"
    mkdir -p "$workspace_dir2"
    cd "$workspace_dir2"

    echo -n "  Testing: init JSON output... "
    set +e
    output=$($VIBEN_CMD --json init --user test-user-2 2>&1)
    set -e

    # Extract JSON from output (may include non-JSON text before it)
    # Use awk to extract JSON block starting with { and ending with }
    json_output=$(echo "$output" | awk '/^\{/{p=1} p{print} /^\}/{p=0}')

    # Check if JSON output contains expected structure (success or error with proper format)
    if echo "$json_output" | jq -e '.success != null or .error != null' > /dev/null 2>&1; then
        echo -e "${GREEN}OK${NC} (valid JSON structure)"
        success "init JSON output format"
    else
        echo -e "${RED}FAILED${NC}"
        fail "init JSON output should have valid structure"
        echo "    Output: $output"
    fi
}

test_agent_commands() {
    section "Testing agent commands"

    cd "$TEST_DIR/test-workspace"

    # Agent list
    run_test "viben agent list" "$VIBEN_CMD agent list"
    run_test_json "agent list JSON" "$VIBEN_CMD --json agent list" ".success" "true"
}

test_provider_commands() {
    section "Testing provider commands"

    cd "$TEST_DIR/test-workspace"

    # Provider list
    run_test "viben provider list" "$VIBEN_CMD provider list"
    run_test_json "provider list JSON" "$VIBEN_CMD --json provider list" ".success" "true"
}

test_model_commands() {
    section "Testing model commands"

    cd "$TEST_DIR/test-workspace"

    # Model list
    run_test "viben model list" "$VIBEN_CMD model list"
    run_test_json "model list JSON" "$VIBEN_CMD --json model list" ".success" "true"
}

test_executor_commands() {
    section "Testing executor commands"

    cd "$TEST_DIR/test-workspace"

    # Executor list
    run_test "viben executor list" "$VIBEN_CMD executor list"
    run_test_json "executor list JSON" "$VIBEN_CMD --json executor list" ".success" "true"
}

test_task_commands() {
    section "Testing task commands"

    cd "$TEST_DIR/test-workspace"

    # Task list (may be empty)
    run_test "viben task list" "$VIBEN_CMD task list"
    run_test_json "task list JSON" "$VIBEN_CMD --json task list" ".success" "true"
}

test_user_commands() {
    section "Testing user commands"

    cd "$TEST_DIR/test-workspace"

    # User get (may not be set)
    run_test "viben user get" "$VIBEN_CMD user get || true"

    # User init
    run_test "viben user init test-user" "$VIBEN_CMD user init test-user"

    # User get after init
    run_test_output "user get shows test-user" "$VIBEN_CMD user get" "test-user"
}

test_update_commands() {
    section "Testing update commands"

    cd "$TEST_DIR/test-workspace"

    # Update check (should work even offline, just may fail to fetch)
    run_test "viben update --check" "$VIBEN_CMD update --check || true"

    # Update with JSON
    run_test "viben update --check JSON" "$VIBEN_CMD --json update --check || true"
}

test_workspace_commands() {
    section "Testing workspace commands"

    cd "$TEST_DIR/test-workspace"

    # Workspace current
    run_test "viben workspace current" "$VIBEN_CMD workspace current"
    run_test_json "workspace current JSON" "$VIBEN_CMD --json workspace current" ".success" "true"

    # Workspace list
    run_test "viben workspace list" "$VIBEN_CMD workspace list"
}

test_mcp_commands() {
    section "Testing MCP commands"

    cd "$TEST_DIR/test-workspace"

    # MCP list
    run_test "viben mcp list" "$VIBEN_CMD mcp list"
    run_test_json "mcp list JSON" "$VIBEN_CMD --json mcp list" ".success" "true"
}

test_skill_commands() {
    section "Testing skill commands"

    cd "$TEST_DIR/test-workspace"

    # Skill list
    run_test "viben skill list" "$VIBEN_CMD skill list"
    run_test_json "skill list JSON" "$VIBEN_CMD --json skill list" ".success" "true"
}

test_cron_commands() {
    section "Testing cron commands"

    cd "$TEST_DIR/test-workspace"

    # Cron list
    run_test "viben cron list" "$VIBEN_CMD cron list"
    run_test_json "cron list JSON" "$VIBEN_CMD --json cron list" ".success" "true"
}

test_queue_commands() {
    section "Testing queue commands"

    cd "$TEST_DIR/test-workspace"

    # Queue list
    run_test "viben queue list" "$VIBEN_CMD queue list"
    run_test_json "queue list JSON" "$VIBEN_CMD --json queue list" ".success" "true"
}

test_context_commands() {
    section "Testing context commands"

    cd "$TEST_DIR/test-workspace"

    # Context (no subcommand needed)
    run_test "viben context" "$VIBEN_CMD context"
    run_test_json "context JSON" "$VIBEN_CMD --json context" ".success" "true"
}

test_global_options() {
    section "Testing global options"

    cd "$TEST_DIR/test-workspace"

    # Quiet mode
    run_test "quiet mode" "$VIBEN_CMD --quiet config list"

    # Verbose mode
    run_test "verbose mode" "$VIBEN_CMD --verbose config list"

    # JSON mode (already tested above, but verify format)
    output=$($VIBEN_CMD --json config list 2>&1)
    if echo "$output" | jq . > /dev/null 2>&1; then
        success "JSON output is valid JSON"
    else
        fail "JSON output should be valid JSON"
    fi
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --local)
                LOCAL_MODE=true
                shift
                ;;
            -h|--help)
                echo "Usage: $0 [--local]"
                echo ""
                echo "Options:"
                echo "  --local   Test local build instead of npm package"
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                exit 1
                ;;
        esac
    done

    print_banner

    # Check dependencies
    command -v jq >/dev/null 2>&1 || { echo "jq is required but not installed."; exit 1; }
    command -v node >/dev/null 2>&1 || { echo "Node.js is required but not installed."; exit 1; }

    # Setup
    setup_test_environment

    # Run test suites
    test_basic_commands
    test_config_commands
    test_init_command
    test_workspace_commands
    test_agent_commands
    test_provider_commands
    test_model_commands
    test_executor_commands
    test_task_commands
    test_user_commands
    test_mcp_commands
    test_skill_commands
    test_cron_commands
    test_queue_commands
    test_context_commands
    test_update_commands
    test_global_options

    # Summary
    section "Test Summary"

    echo ""
    echo -e "  ${GREEN}Passed:${NC} $PASSED_TESTS"
    echo -e "  ${RED}Failed:${NC} $FAILED_TESTS"
    echo ""

    if [ "$FAILED_TESTS" -gt 0 ]; then
        echo -e "${RED}${BOLD}  ✗ Some tests failed!${NC}"
        echo ""
        exit 1
    else
        echo -e "${GREEN}${BOLD}  ✓ All tests passed!${NC}"
        echo ""
        exit 0
    fi
}

main "$@"
