#!/bin/bash
# Pre-release checks - validates code quality before release
#
# Usage: pnpm check:release
# This script runs automatically before release, or can be run manually.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Pre-Release Checks${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

FAILED=0

# Helper function for check results
check_pass() {
  echo -e "${GREEN}✓${NC} $1"
}

check_fail() {
  echo -e "${RED}✗${NC} $1"
  FAILED=1
}

check_warn() {
  echo -e "${YELLOW}⚠${NC} $1"
}

# 1. Check pnpm lockfile is up to date
echo -e "${BLUE}[1/6] Checking pnpm lockfile...${NC}"
if pnpm install --frozen-lockfile --ignore-scripts 2>/dev/null; then
  check_pass "pnpm lockfile is up to date"
else
  check_fail "pnpm lockfile is out of sync. Run 'pnpm install' and commit pnpm-lock.yaml"
fi
echo ""

# 2. TypeScript type checking
echo -e "${BLUE}[2/6] Running TypeScript type check...${NC}"
if pnpm typecheck 2>&1 | tee /tmp/typecheck-output.txt | tail -5; then
  # Check for actual TypeScript errors (error TS), not rollup/bundler warnings
  if grep -qE "error TS[0-9]+" /tmp/typecheck-output.txt; then
    check_fail "TypeScript type errors found"
  else
    check_pass "TypeScript type check passed"
  fi
else
  # Command failed - check if it's a real TS error or just turbo task failure
  if grep -qE "error TS[0-9]+" /tmp/typecheck-output.txt; then
    check_fail "TypeScript type errors found"
  else
    check_fail "TypeScript type check failed"
  fi
fi
echo ""

# 3. ESLint check
echo -e "${BLUE}[3/6] Running ESLint...${NC}"
if pnpm lint 2>&1 | tee /tmp/lint-output.txt | tail -5; then
  if grep -qE "[0-9]+ error" /tmp/lint-output.txt; then
    check_fail "ESLint errors found"
  else
    check_pass "ESLint check passed"
  fi
else
  # lint command may return non-zero on warnings, check output
  if grep -qE "[0-9]+ error" /tmp/lint-output.txt; then
    check_fail "ESLint errors found"
  else
    check_warn "ESLint completed with warnings"
  fi
fi
echo ""

# 4. Rust cargo check (for Tauri)
echo -e "${BLUE}[4/6] Running Cargo check (Tauri)...${NC}"
if (cd apps/desktop/src-tauri && cargo check 2>&1) | tail -5; then
  check_pass "Cargo check passed"
else
  check_fail "Cargo check failed"
fi
echo ""

# 5. Check for uncommitted changes
echo -e "${BLUE}[5/6] Checking for uncommitted changes...${NC}"
if [[ -z "$(git status --porcelain)" ]]; then
  check_pass "Working directory is clean"
else
  check_warn "Uncommitted changes detected:"
  git status --short
fi
echo ""

# 6. Check we're on main branch
echo -e "${BLUE}[6/6] Checking current branch...${NC}"
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" == "main" ]]; then
  check_pass "On main branch"
else
  check_warn "Not on main branch (current: $CURRENT_BRANCH)"
fi
echo ""

# Summary
echo -e "${BLUE}========================================${NC}"
if [[ $FAILED -eq 0 ]]; then
  echo -e "${GREEN}All pre-release checks passed!${NC}"
  echo -e "${BLUE}========================================${NC}"
  exit 0
else
  echo -e "${RED}Pre-release checks failed!${NC}"
  echo -e "${BLUE}========================================${NC}"
  echo ""
  echo -e "${YELLOW}Please fix the issues above before releasing.${NC}"
  exit 1
fi
