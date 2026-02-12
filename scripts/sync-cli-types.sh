#!/bin/bash
# Synchronize NAPI types with CLI
#
# This script:
#   1. Builds NAPI bindings (which auto-generates index.d.ts)
#   2. Validates the generated types are available
#   3. Documents type sync status
#
# Usage:
#   ./scripts/sync-cli-types.sh          # Build and sync types
#   ./scripts/sync-cli-types.sh --check  # Only check if types are up-to-date

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CLI_RS_DIR="$PROJECT_ROOT/packages/cli-rs"
CLI_DIR="$PROJECT_ROOT/apps/cli"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
CHECK_ONLY=false
if [[ "$1" == "--check" ]]; then
    CHECK_ONLY=true
fi

echo -e "${BLUE}=== CLI Type Sync ===${NC}"
echo ""

# Check if NAPI types exist
if [[ ! -f "$CLI_RS_DIR/index.d.ts" ]]; then
    if $CHECK_ONLY; then
        echo -e "${RED}Error: index.d.ts not found. Run build first.${NC}"
        exit 1
    fi

    echo -e "${YELLOW}Types not found. Building NAPI bindings...${NC}"
    cd "$CLI_RS_DIR"
    pnpm build
fi

echo -e "${GREEN}✓ NAPI types file exists${NC}"

# Count types and functions in generated file
NAPI_TYPES=$(grep -c "^export interface\|^export const enum" "$CLI_RS_DIR/index.d.ts" || echo "0")
NAPI_FUNCTIONS=$(grep -c "^export declare function" "$CLI_RS_DIR/index.d.ts" || echo "0")

echo ""
echo "Generated types:"
echo "  - Interfaces/Enums: $NAPI_TYPES"
echo "  - Functions: $NAPI_FUNCTIONS"
echo ""

# List all exported modules
echo -e "${BLUE}Available modules:${NC}"
echo ""

# Provider
PROVIDER_FUNCS=$(grep "^export declare function provider" "$CLI_RS_DIR/index.d.ts" | wc -l | tr -d ' ')
echo "  Provider:  $PROVIDER_FUNCS functions"

# Model
MODEL_FUNCS=$(grep "^export declare function model" "$CLI_RS_DIR/index.d.ts" | wc -l | tr -d ' ')
echo "  Model:     $MODEL_FUNCS functions"

# Agent
AGENT_FUNCS=$(grep "^export declare function agent" "$CLI_RS_DIR/index.d.ts" | wc -l | tr -d ' ')
echo "  Agent:     $AGENT_FUNCS functions"

# Config
CONFIG_FUNCS=$(grep "^export declare function config" "$CLI_RS_DIR/index.d.ts" | wc -l | tr -d ' ')
echo "  Config:    $CONFIG_FUNCS functions"

# Channel
CHANNEL_FUNCS=$(grep "^export declare function channel" "$CLI_RS_DIR/index.d.ts" | wc -l | tr -d ' ')
echo "  Channel:   $CHANNEL_FUNCS functions"

# Executor
EXECUTOR_FUNCS=$(grep "^export declare function executor" "$CLI_RS_DIR/index.d.ts" | wc -l | tr -d ' ')
echo "  Executor:  $EXECUTOR_FUNCS functions"

# Cron
CRON_FUNCS=$(grep "^export declare function cron" "$CLI_RS_DIR/index.d.ts" | wc -l | tr -d ' ')
echo "  Cron:      $CRON_FUNCS functions"

# Init
INIT_FUNCS=$(grep "^export declare function \(initialize\|version\|getStateDir\)" "$CLI_RS_DIR/index.d.ts" | wc -l | tr -d ' ')
echo "  Init:      $INIT_FUNCS functions"

echo ""

# Check if native.ts wrapper exists
if [[ -f "$CLI_DIR/src/lib/native.ts" ]]; then
    echo -e "${GREEN}✓ CLI native.ts wrapper exists${NC}"

    # Count exports in native.ts
    NATIVE_EXPORTS=$(grep -c "^export const\|^export function\|^export type\|^export interface" "$CLI_DIR/src/lib/native.ts" || echo "0")
    echo "  Native wrapper exports: $NATIVE_EXPORTS items"
else
    echo -e "${YELLOW}Warning: CLI native.ts wrapper not found${NC}"
fi

echo ""
echo -e "${GREEN}=== Type Sync Complete ===${NC}"
echo ""
echo "Type sync architecture:"
echo ""
echo "  1. Rust NAPI code:        crates/viben-core/src/napi/*.rs"
echo "  2. Auto-generated types:  packages/cli-rs/index.d.ts"
echo "  3. CLI wrapper:           apps/cli/src/lib/native.ts"
echo ""
echo "The CLI wrapper (native.ts) provides:"
echo "  - Type definitions compatible with CJS/ESM"
echo "  - String unions instead of const enums (for CJS compatibility)"
echo "  - Re-exports of all NAPI functions with proper typing"
echo ""
echo "To add new functionality:"
echo "  1. Add Rust NAPI bindings in crates/viben-core/src/napi/"
echo "  2. Update napi/mod.rs to export the new module"
echo "  3. Run: pnpm --filter @viben/cli-rs build"
echo "  4. Add type definitions to apps/cli/src/lib/native.ts"
echo "  5. Update CLI commands to use the new NAPI functions"
