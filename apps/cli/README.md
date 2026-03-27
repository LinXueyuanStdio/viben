# Viben CLI

[![npm version](https://img.shields.io/npm/v/viben.svg)](https://www.npmjs.com/package/viben)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Agent Swarm × Code Evolution** - Command-line interface for Viben.

## Overview

Viben CLI enables autonomous code evolution through multi-agent orchestration:

- **FileRL** - Reinforcement learning for code iteration and optimization
- **Multi-Agent Swarm** - Coordinate multiple AI agents working in parallel
- **MCP Protocol** - Model Context Protocol for seamless tool integration
- **XState Task System** - State machine-driven task workflow management
- **Idea Generation** - Transform ideas into executable development tasks

## Installation

### Quick Start with npx (Recommended)

No installation needed - just run:

```bash
npx viben --help
```

### Global Installation

```bash
npm install -g viben
viben --help
```

## Commands

### Workspace Commands

```bash
# Initialize a workspace
viben init
viben init --from <template>

# Manage configuration (git-style)
viben config list                    # List all config
viben config list --show-origin      # Show config sources
viben config get <key>               # Get a value
viben config set <key> <value>       # Set a value
viben config unset <key>             # Remove a value
viben config edit                    # Open in editor

# Manage agents
viben agent list                     # List all agents
viben agent create -n <id>           # Create new agent
viben agent show -n <id>             # Show agent details
```

### Server Commands

```bash
# Start MCP server (wraps browse-mcp Python package)
viben serve                          # Start in stdio mode
viben serve -t sse --port 8080       # Start SSE server
viben mcp                            # Alias for serve
```

## Global Options

```bash
--json          Output in JSON format (for agent consumption)
-g, --global    Use global scope (~/.viben/)
-w, --workspace Use workspace scope (.viben/)
--verbose       Enable verbose output
-q, --quiet     Suppress non-essential output
-v, --version   Show version
-h, --help      Show help
```

## Configuration

### File Locations

- **Global config**: `~/.viben/config.yaml`
- **Workspace config**: `<project>/.viben/config.yaml`
- **Global agents**: `~/.viben/agents/*.yaml`
- **Workspace agents**: `<project>/.viben/agents/*.yaml`

### Environment Variables

```bash
VIBEN_STATE_DIR   # Override state directory (default: ~/.viben)
VIBEN_AGENT       # Current agent ID
VIBEN_SCOPE       # Default scope (global/workspace)
```

### Config File Format

```yaml
# .viben/config.yaml
version: 1

settings:
  editor: code
  pager: less
  color: auto

agents:
  - main

mcp:
  enabled:
    - filesystem
    - git

skills:
  enabled:
    - code-review
```

## JSON Output Mode

All commands support `--json` for structured output:

```bash
# Human-readable (default)
viben agent list
# ID    Name        Model      Source
# main  Main Agent  (default)  workspace

# JSON output
viben --json agent list
# {
#   "success": true,
#   "data": {
#     "agents": [{ "id": "main", "name": "Main Agent", ... }],
#     "count": 1
#   }
# }
```

## MCP Server

The `serve` command wraps the [browse-mcp](https://pypi.org/project/browse-mcp/) Python package.

### Requirements

- **Node.js 18+** - For the CLI
- **Python 3.10+** - For the MCP server
- **pip or uv** - For Python package installation

### MCP Client Configuration

#### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "viben": {
      "command": "npx",
      "args": ["viben", "serve"]
    }
  }
}
```

#### Claude Code

Add to `~/.config/claude/config.json`:

```json
{
  "mcpServers": {
    "viben": {
      "command": "npx",
      "args": ["viben", "serve"]
    }
  }
}
```

## Links

- [GitHub Repository](https://github.com/LinXueyuanStdio/viben)
- [PyPI Package (browse-mcp)](https://pypi.org/project/browse-mcp/)
- [Documentation](https://github.com/LinXueyuanStdio/viben#readme)

## License

MIT
