---
sidebar_position: 1
title: "Commands Overview"
description: "Overview of Viben CLI commands, global options, and output formats"
---

# Commands Overview

The Viben CLI (`viben`) is a bootstrap tool for configuring applications, managing services, and querying status. It is designed to be used by both humans and AI agents.

## Command Structure

```
viben <command> [subcommand] [options]
```

## Available Commands

| Command | Description |
|---------|-------------|
| [`init`](/docs/cli/commands/init) | Initialize workspace in current directory |
| [`config`](/docs/cli/commands/config) | Configuration management (git-style) |
| [`service`](/docs/cli/commands/service) | Manage background services |
| [`agent`](/docs/cli/commands/agent) | Manage agent instances and templates |
| [`provider`](/docs/cli/commands/provider) | Manage API providers (OpenAI, Anthropic, etc.) |
| [`model`](/docs/cli/commands/model) | Manage models, aliases, and fallbacks |
| [`mcp`](/docs/cli/commands/mcp) | Manage MCP servers |
| [`skill`](/docs/cli/commands/skill) | Manage skills |
| [`workspace`](/docs/cli/commands/workspace) | Workspace operations |
| `version` | Show version info |
| `help` | Show help |

## Global Options

These options are available for all commands:

| Option | Short | Description |
|--------|-------|-------------|
| `--json` | | Output as JSON (for Agent parsing) |
| `--global` | `-g` | Use global config |
| `--workspace` | | Use workspace config (current directory) |
| `--name <id>` | `-n` | Specify agent name/ID (default: current or 'main') |
| `--verbose` | `-v` | Verbose output |
| `--quiet` | `-q` | Suppress non-essential output |
| `--help` | `-h` | Show help |

## JSON Output Format

All commands support the `--json` flag for structured output, which is useful for AI agents and scripting.

### Response Schema

```typescript
interface CLIResponse {
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
  };
}
```

### Success Response

```json
{
  "success": true,
  "data": {
    "path": "/path/to/project/.viben",
    "files": ["config.yaml"]
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "MCP_NOT_FOUND",
    "message": "MCP server 'unknown-mcp' not found in marketplace"
  }
}
```

## Scope Resolution

The CLI automatically detects the scope (global or workspace) based on the current directory:

| Priority | Source | Description |
|----------|--------|-------------|
| 1 | Command line flag | `--global` or `--workspace` |
| 2 | Environment variable | `VIBEN_SCOPE` |
| 3 | Auto-detection | If `.viben/` exists in current or parent directory: workspace; otherwise: global |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VIBEN_STATE_DIR` | State directory | `~/.viben` |
| `VIBEN_CONFIG_PATH` | Config file path | `~/.viben/config.yaml` |
| `VIBEN_AGENT` | Current agent ID | `main` |
| `VIBEN_SCOPE` | Config scope | Auto-detect |

## Configuration Files

### Global Configuration

Located at `~/.viben/config.yaml`:

```yaml
version: 1

settings:
  editor: code
  pager: less
  color: auto

agents:
  - claude-code
  - cursor

mcp:
  enabled:
    - filesystem
    - git
  disabled:
    - browser

skills:
  enabled:
    - code-review
    - commit
```

### Workspace Configuration

Located at `<project>/.viben/config.yaml`, overrides global settings for the workspace.

## Agent Integration

AI agents can use the CLI via Bash tools:

```bash
# Get current configuration
viben config list --json

# Install MCP for workspace
viben mcp install filesystem --workspace --json

# Configure agent MCP
viben agent config claude-code mcp add filesystem --json

# Sync to agent
viben agent sync claude-code --json
```

## Next Steps

- [viben init](/docs/cli/commands/init) - Initialize a workspace
- [viben config](/docs/cli/commands/config) - Manage configuration
- [viben agent](/docs/cli/commands/agent) - Manage agents
- [viben mcp](/docs/cli/commands/mcp) - Manage MCP servers
