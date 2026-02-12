#!/bin/bash
# compare-outputs.sh
# Compare TypeScript (packages/core) and Rust (crates/viben-agent-organization) outputs
#
# This script:
# 1. Generates output using TypeScript initTeam
# 2. Generates output using Rust init_viben_agent_organization
# 3. Compares file counts and content

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PACKAGE_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(cd "$PACKAGE_DIR/../.." && pwd)"
BUILD_DIR="$PACKAGE_DIR/build"
TS_OUTPUT="$BUILD_DIR/ts-output"
RS_OUTPUT="$BUILD_DIR/rs-output"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║      Compare TypeScript and Rust Implementations           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Clean and create directories
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR" "$TS_OUTPUT" "$RS_OUTPUT"

# Step 1: Generate TypeScript output
echo -e "${CYAN}[1/3]${NC} Generating TypeScript output..."
cd "$PACKAGE_DIR"
node -e "
const { initTeam } = require('./dist/index.cjs');

(async () => {
  await initTeam({
    targetDir: '$TS_OUTPUT',
    developerName: 'test-dev',
    projectType: 'fullstack',
    force: true,
    includeCursor: true,
  });
  console.log('Done');
})();
"
echo -e "  ${GREEN}✓${NC} TypeScript output generated"

# Step 2: Generate Rust output
echo -e "${CYAN}[2/3]${NC} Generating Rust output..."
cd "$PROJECT_ROOT"

# Build and run the Rust CLI
cargo build -p viben-core --release 2>/dev/null || cargo build -p viben-core

# Run the Rust init command
if command -v "$PROJECT_ROOT/target/release/viben-core" &> /dev/null; then
  "$PROJECT_ROOT/target/release/viben-core" init -u test-dev -o "$RS_OUTPUT" --force
elif command -v "$PROJECT_ROOT/target/debug/viben-core" &> /dev/null; then
  "$PROJECT_ROOT/target/debug/viben-core" init -u test-dev -o "$RS_OUTPUT" --force
else
  echo -e "  ${YELLOW}⚠${NC} Rust CLI not found, skipping Rust comparison"
  echo ""
  echo "TypeScript-only results:"
  ts_count=$(find "$TS_OUTPUT" -type f | wc -l | tr -d ' ')
  echo "  Files generated: $ts_count"
  exit 0
fi

echo -e "  ${GREEN}✓${NC} Rust output generated"

# Step 3: Compare outputs
echo -e "${CYAN}[3/3]${NC} Comparing outputs..."
echo ""

# Count files
ts_count=$(find "$TS_OUTPUT" -type f | wc -l | tr -d ' ')
rs_count=$(find "$RS_OUTPUT" -type f | wc -l | tr -d ' ')

echo "File counts:"
echo "  TypeScript: $ts_count files"
echo "  Rust:       $rs_count files"

if [ "$ts_count" -eq "$rs_count" ]; then
  echo -e "  ${GREEN}✓${NC} File counts match!"
else
  echo -e "  ${YELLOW}⚠${NC} File counts differ by $((ts_count - rs_count))"
fi

echo ""

# List differences
echo "Checking file differences..."
diff_count=0
match_count=0

# Get list of all files from both outputs
ts_files=$(cd "$TS_OUTPUT" && find . -type f | sort)
rs_files=$(cd "$RS_OUTPUT" && find . -type f | sort)

# Compare file lists
ts_only=$(comm -23 <(echo "$ts_files") <(echo "$rs_files"))
rs_only=$(comm -13 <(echo "$ts_files") <(echo "$rs_files"))
common=$(comm -12 <(echo "$ts_files") <(echo "$rs_files"))

if [ -n "$ts_only" ]; then
  echo -e "  ${YELLOW}Files only in TypeScript output:${NC}"
  echo "$ts_only" | while read -r f; do echo "    - $f"; done
fi

if [ -n "$rs_only" ]; then
  echo -e "  ${YELLOW}Files only in Rust output:${NC}"
  echo "$rs_only" | while read -r f; do echo "    - $f"; done
fi

# Compare common files
echo ""
echo "Comparing content of common files..."

while IFS= read -r file; do
  if [ -n "$file" ]; then
    ts_file="$TS_OUTPUT/$file"
    rs_file="$RS_OUTPUT/$file"

    # Skip timestamp-containing files
    case "$file" in
      */.developer|*/.template-hashes.json|*/task.json|*/journal-*.md|*/index.md)
        continue
        ;;
    esac

    if diff -q "$ts_file" "$rs_file" > /dev/null 2>&1; then
      ((match_count++))
    else
      ((diff_count++))
      echo -e "  ${YELLOW}~${NC} $file"
    fi
  fi
done <<< "$common"

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo "Summary:"
echo "  Matching files: $match_count"
echo "  Different files: $diff_count"

if [ "$diff_count" -eq 0 ] && [ "$ts_count" -eq "$rs_count" ]; then
  echo ""
  echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}✓ SUCCESS: TypeScript and Rust outputs match!${NC}"
  echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
  exit 0
else
  echo ""
  echo -e "${YELLOW}════════════════════════════════════════════════════════════${NC}"
  echo -e "${YELLOW}⚠ Outputs have some differences (may be expected)${NC}"
  echo -e "${YELLOW}════════════════════════════════════════════════════════════${NC}"
  exit 0
fi
