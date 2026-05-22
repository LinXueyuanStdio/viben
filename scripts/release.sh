#!/bin/bash
# Release script - validates changelog and triggers GitHub Actions release workflow
#
# Usage: pnpm release --version <version>
# Example: pnpm release --version 1.2.0

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
VERSION=""
DRAFT=false
SKIP_CLI=false
SKIP_DESKTOP=false
YES=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --version|-v)
      VERSION="$2"
      shift 2
      ;;
    --draft)
      DRAFT=true
      shift
      ;;
    --skip-cli)
      SKIP_CLI=true
      shift
      ;;
    --skip-desktop)
      SKIP_DESKTOP=true
      shift
      ;;
    --yes|-y)
      YES=true
      shift
      ;;
    --help|-h)
      echo "Usage: pnpm release --version <version> [options]"
      echo ""
      echo "Options:"
      echo "  --version, -v <version>  Version to release (required, e.g., 1.2.0)"
      echo "  --draft                  Create as draft release"
      echo "  --skip-cli               Skip CLI release"
      echo "  --skip-desktop           Skip Desktop release"
      echo "  --yes, -y                Skip confirmation prompt"
      echo "  --help, -h               Show this help message"
      echo ""
      echo "Prerequisites:"
      echo "  - Changelog file must exist at docs/changelogs/<version>.md"
      echo "  - GitHub CLI (gh) must be installed and authenticated"
      echo ""
      echo "Example:"
      echo "  pnpm release --version 1.2.0"
      echo "  pnpm release --version 1.2.0 --draft"
      exit 0
      ;;
    *)
      echo -e "${RED}Error: Unknown option $1${NC}"
      exit 1
      ;;
  esac
done

# Validate version is provided
if [[ -z "$VERSION" ]]; then
  echo -e "${RED}Error: --version is required${NC}"
  echo "Usage: pnpm release --version <version>"
  echo "Example: pnpm release --version 1.2.0"
  exit 1
fi

# Validate version format (semver)
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$ ]]; then
  echo -e "${RED}Error: Invalid version format '$VERSION'${NC}"
  echo "Version must be in semver format (e.g., 1.2.0, 1.2.0-beta.1)"
  exit 1
fi

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Run pre-release checks
echo -e "${BLUE}Running pre-release checks...${NC}"
echo ""

if ! "$SCRIPT_DIR/check-before-release.sh"; then
  echo ""
  echo -e "${RED}Error: Pre-release checks failed${NC}"
  echo -e "${YELLOW}Please fix the issues above before releasing.${NC}"
  exit 1
fi

echo ""

# Check changelog exists
CHANGELOG_PATH="$PROJECT_ROOT/docs/changelogs/$VERSION.md"
if [[ ! -f "$CHANGELOG_PATH" ]]; then
  echo -e "${RED}Error: Changelog not found at docs/changelogs/$VERSION.md${NC}"
  echo ""
  echo -e "${YELLOW}Please create the changelog file before releasing.${NC}"
  echo ""
  echo "Expected path: $CHANGELOG_PATH"
  echo ""
  echo "Changelog template:"
  echo "---"
  cat << 'EOF'
# Viben v<version> Changelog

## Highlights

- Feature 1: Brief description
- Feature 2: Brief description

## New Features

### Feature Name
Description of the feature.

## Improvements

- Improvement 1
- Improvement 2

## Bug Fixes

- Fix 1
- Fix 2

## Breaking Changes

- Breaking change 1 (if any)

## Contributors

Thanks to all contributors for this release!
EOF
  echo "---"
  exit 1
fi

# Check GitHub CLI is installed
if ! command -v gh &> /dev/null; then
  echo -e "${RED}Error: GitHub CLI (gh) is not installed${NC}"
  echo "Install it from: https://cli.github.com/"
  exit 1
fi

# Check GitHub CLI is authenticated
if ! gh auth status &> /dev/null; then
  echo -e "${RED}Error: GitHub CLI is not authenticated${NC}"
  echo "Run: gh auth login"
  exit 1
fi

# Display release info
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Viben Release v$VERSION${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}Changelog found:${NC} docs/changelogs/$VERSION.md"
echo ""

# Show changelog preview
echo -e "${YELLOW}Changelog Preview:${NC}"
echo "---"
head -30 "$CHANGELOG_PATH"
if [[ $(wc -l < "$CHANGELOG_PATH") -gt 30 ]]; then
  echo "... (truncated, see full changelog in docs/changelogs/$VERSION.md)"
fi
echo "---"
echo ""

# Build workflow dispatch arguments
WORKFLOW_ARGS="--ref main -f version=$VERSION"

if [[ "$DRAFT" == "true" ]]; then
  WORKFLOW_ARGS="$WORKFLOW_ARGS -f draft=true"
fi

if [[ "$SKIP_CLI" == "true" ]]; then
  WORKFLOW_ARGS="$WORKFLOW_ARGS -f release_cli=false"
fi

if [[ "$SKIP_DESKTOP" == "true" ]]; then
  WORKFLOW_ARGS="$WORKFLOW_ARGS -f release_desktop=false"
fi

# Confirm release
echo -e "${YELLOW}Release Configuration:${NC}"
echo "  Version: $VERSION"
echo "  Draft: $DRAFT"
echo "  Release CLI: $([[ "$SKIP_CLI" == "true" ]] && echo "false" || echo "true")"
echo "  Release Desktop: $([[ "$SKIP_DESKTOP" == "true" ]] && echo "false" || echo "true")"
echo ""

if [[ "$YES" != "true" ]]; then
  read -p "Proceed with release? (y/N) " -n 1 -r
  echo ""

  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Release cancelled.${NC}"
    exit 0
  fi
fi

# Trigger GitHub Actions workflow
echo ""
echo -e "${BLUE}Triggering release workflow...${NC}"

gh workflow run release-all.yml $WORKFLOW_ARGS

echo ""
echo -e "${GREEN}Release workflow triggered successfully!${NC}"
echo ""
echo "Monitor the release at:"
echo "  https://github.com/LinXueyuanStdio/viben/actions/workflows/release-all.yml"
echo ""
echo "The workflow will:"
echo "  1. Sync version across all packages"
echo "  2. Build and test CLI on all platforms"
echo "  3. Publish CLI to npm"
echo "  4. Build Desktop apps for macOS, Windows, and Linux"
echo "  5. Create GitHub Release with changelog"
