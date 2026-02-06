---
sidebar_position: 1
title: "CLI Overview"
description: "Viben CLI - Bootstrap tool for configuring applications, managing services, and querying status"
---

# Viben CLI

**Viben CLI** (`viben`) is a bootstrap tool for configuring applications, managing AI agent instances, and querying system status. It serves both human users and AI agents, providing a unified interface for complex configuration tasks.

## What is Viben CLI?

Viben CLI is designed with two primary use cases:

1. **For Humans**: Command-line configuration of applications, starting services, and viewing status
2. **For AI Agents**: Agents use the CLI via Bash tools to configure complex agent setups, MCP servers, and skills

## Key Features

| Feature | Description |
|---------|-------------|
| **Agent Management** | Create, configure, and manage multiple AI agent instances |
| **Provider Configuration** | Set up API providers (OpenAI, Anthropic, Google, Azure, etc.) |
| **Model Management** | Configure model aliases, fallbacks, and per-model settings |
| **MCP Server Management** | Install, enable, and configure MCP servers |
| **Skills Management** | Install and manage agent skills |
| **Service Control** | Start, stop, and monitor background services |
| **Scope-Aware** | Automatic workspace detection with global/workspace config support |

## Design Principles

### Simple and Focused

The CLI does not handle complex interactive tasks. It focuses on:
- Configuration management
- Status queries
- Service lifecycle

### Human + Machine Friendly

- **Human mode**: Colorful, formatted terminal output (default)
- **Machine mode**: Structured JSON output with `--json` flag for AI agents to parse

### Scope Aware

The CLI automatically detects your workspace context:
- If you're in a directory with `.viben/`, workspace config is used
- Otherwise, global config (`~/.viben/`) is used
- Override with `--global` or `--workspace` flags

## Tech Stack

| Component | Choice | Reason |
|-----------|--------|--------|
| Runtime | Node.js | Reuse existing TypeScript code and packages |
| Framework | Commander.js | Mature, stable, rich ecosystem |
| Config | YAML | Human-readable, supports comments |
| Output | Chalk + JSON | Colored terminal + structured output |

## Command Overview

```
viben <command> [subcommand] [options]

Commands:
  init          Initialize workspace in current directory
  config        Configuration management (git-style)
  service       Manage background services
  agent         Manage agent instances and templates
  provider      Manage API providers (OpenAI, Anthropic, etc.)
  model         Manage models, aliases, and fallbacks
  mcp           Manage MCP servers
  skill         Manage skills
  workspace     Workspace operations
  version       Show version info
  help          Show help
```

### Global Options

All commands support these global options:

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON (for agent parsing) |
| `--global`, `-g` | Use global config |
| `--workspace` | Use workspace config (current directory) |
| `-n`, `--name <id>` | Specify agent name/ID (default: current or 'main') |
| `--verbose`, `-v` | Verbose output |
| `--quiet`, `-q` | Suppress non-essential output |
| `--help`, `-h` | Show help |

## Architecture Overview

```
~/.viben/                                    # State directory
├── config.yaml                              # Global configuration
├── agents/                                  # Agent instances
│   └── <agent-id>/                          # Individual agent
│       ├── config.yaml                      # Agent configuration
│       ├── mcp_servers.json                 # MCP servers config
│       ├── skills/                          # Agent-specific skills
│       └── memory/                          # Agent memory
├── providers.yaml                           # API provider configurations
├── models.yaml                              # Model configurations
├── mcp/                                     # Shared MCP servers
└── skills/                                  # Shared skills

<project>/.viben/                            # Workspace config (optional)
└── config.yaml                              # Workspace-specific overrides
```

## Configuration File Format

Viben CLI uses YAML for human-readable configuration:

```yaml
# ~/.viben/config.yaml
version: 1

# Global settings
settings:
  editor: code
  pager: less
  color: auto

# Default MCP servers
mcp:
  enabled:
    - filesystem
    - git

# Default skills
skills:
  enabled:
    - code-review
    - commit
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VIBEN_STATE_DIR` | State directory | `~/.viben` |
| `VIBEN_CONFIG_PATH` | Config file path | `~/.viben/config.yaml` |
| `VIBEN_AGENT` | Current agent ID | `main` |
| `VIBEN_SCOPE` | Config scope | Auto-detected |

## Agent Integration

AI agents can use Viben CLI through Bash tool calls. The `--json` flag ensures structured output that agents can parse:

```bash
# Get current configuration
viben config list --json

# Install MCP server for workspace
viben mcp install filesystem --workspace --json

# Configure agent
viben agent config my-agent set model gpt-4 --json
```

### JSON Response Format

All commands with `--json` flag return structured responses:

```json
{
  "success": true,
  "data": {
    "key": "value"
  }
}
```

Error responses include error codes for programmatic handling:

```json
{
  "success": false,
  "error": {
    "code": "MCP_NOT_FOUND",
    "message": "MCP server 'unknown-mcp' not found in marketplace"
  }
}
```

## Next Steps

- [Installation](/docs/cli/installation) - Install Viben CLI
- [Quick Start](/docs/cli/quick-start) - Get started with basic configuration
