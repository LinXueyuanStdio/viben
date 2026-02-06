# Viben CLI

[![npm version](https://img.shields.io/npm/v/viben.svg)](https://www.npmjs.com/package/viben)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Node.js wrapper for [browse-mcp](https://pypi.org/project/browse-mcp/) - an MCP server for searching, downloading, and reading academic papers.

## Installation

### Quick Start with npx (Recommended)

No installation needed - just run:

```bash
npx viben
```

This will:
1. Check for Python 3.10+
2. Install `browse-mcp` if not already installed
3. Start the MCP server

### Global Installation

```bash
npm install -g viben
viben
```

## Usage

```bash
# Start MCP server (default: stdio mode)
npx viben

# Show help
npx viben --help

# Start with SSE transport
npx viben -t sse --port 8080

# Force reinstall browse-mcp
npx viben --install
```

## Requirements

- **Node.js 18+** - For running the wrapper
- **Python 3.10+** - For the browse-mcp package
- **pip or uv** - For Python package installation

## What This Package Does

This is a thin wrapper that:

1. Checks if Python 3.10+ is available
2. Checks if `browse-mcp` Python package is installed
3. Installs `browse-mcp` automatically if needed (using uv or pip)
4. Proxies all arguments to the `browse-mcp` command

The actual functionality is provided by the [browse-mcp](https://pypi.org/project/browse-mcp/) Python package.

## MCP Client Configuration

After running `npx viben`, configure your MCP client:

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "browse-mcp": {
      "command": "npx",
      "args": ["viben"]
    }
  }
}
```

### Claude Code

Add to `~/.config/claude/config.json`:

```json
{
  "mcpServers": {
    "browse-mcp": {
      "command": "npx",
      "args": ["viben"]
    }
  }
}
```

## Alternative Installation Methods

### Shell Script

```bash
curl -fsSL https://github.com/LinXueyuanStdio/viben/releases/latest/download/install.sh | bash
```

### pip (Direct Python)

```bash
pip install browse-mcp
```

### uv (Faster)

```bash
uv pip install browse-mcp
```

## Links

- [GitHub Repository](https://github.com/LinXueyuanStdio/viben)
- [PyPI Package (browse-mcp)](https://pypi.org/project/browse-mcp/)
- [Documentation](https://github.com/LinXueyuanStdio/viben#readme)

## License

MIT
