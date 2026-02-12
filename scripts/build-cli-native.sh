#!/bin/bash
# Build NAPI bindings for CLI
#
# Usage:
#   ./scripts/build-cli-native.sh          # Build release
#   ./scripts/build-cli-native.sh --debug  # Build debug
#
# This script:
#   1. Builds NAPI bindings in packages/cli-rs
#   2. Types are automatically available via @viben/cli-rs package

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CLI_RS_DIR="$PROJECT_ROOT/packages/cli-rs"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse arguments
BUILD_TYPE="release"
if [[ "$1" == "--debug" ]]; then
    BUILD_TYPE="debug"
fi

echo -e "${GREEN}=== Building CLI Native Bindings ===${NC}"
echo "Build type: $BUILD_TYPE"
echo ""

# Build NAPI bindings
echo -e "${YELLOW}Building NAPI bindings...${NC}"
cd "$CLI_RS_DIR"

if [[ "$BUILD_TYPE" == "debug" ]]; then
    pnpm build:debug
else
    pnpm build
fi

# Check if build succeeded
if [[ ! -f "$CLI_RS_DIR/index.node" ]]; then
    echo -e "${RED}Error: index.node not found after build${NC}"
    exit 1
fi

if [[ ! -f "$CLI_RS_DIR/index.d.ts" ]]; then
    echo -e "${RED}Error: index.d.ts not found after build${NC}"
    exit 1
fi

echo -e "${GREEN}✓ NAPI build complete${NC}"
echo ""
echo -e "${GREEN}=== Build Complete ===${NC}"
echo ""
echo "Generated files:"
echo "  - packages/cli-rs/index.node (native module)"
echo "  - packages/cli-rs/index.d.ts (generated types)"
echo ""
echo "Types are available via @viben/cli-rs package."
echo ""
echo "Usage in CLI:"
echo "  import { agentList, type Agent } from '../lib/native';"
echo ""
echo "The native.ts wrapper in apps/cli/src/lib/native.ts re-exports"
echo "all types and functions from @viben/cli-rs for convenience."
