---
sidebar_position: 1
title: "Configuration Overview"
description: "Overview of Viben CLI configuration system - file locations, environment variables, and scope resolution"
---

# Configuration Overview

The Viben CLI uses a layered configuration system that supports both global and workspace-specific settings. Configuration files are stored in YAML format for human readability and easy editing.

## Configuration File Locations

The CLI uses the following directory structure for configuration:

```
~/.viben/                                    # State directory (VIBEN_STATE_DIR)
├── config.yaml                              # Global configuration
├── providers.yaml                           # API Provider configurations
├── models.yaml                              # Model configurations (aliases, fallbacks)
├── agents/                                  # Agent instances
│   └── <agent-id>/
│       ├── config.yaml                      # Agent-specific config
│       └── mcp_servers.json                 # MCP servers for this agent
├── agent-templates/                         # Reusable agent templates
├── mcp/                                     # Shared MCP servers (all agents)
│   └── installed.yaml
└── skills/                                  # Shared skills (all agents)
    └── installed.yaml

<project>/                                   # Project workspace
├── .viben/
│   └── config.yaml                          # Workspace config (overrides global)
├── .claude/                                 # Claude Code workspace config
└── .cursor/                                 # Cursor workspace config
```

## Environment Variables

The following environment variables control CLI behavior:

| Variable | Description | Default |
|----------|-------------|---------|
| `VIBEN_STATE_DIR` | Root directory for all Viben state files | `~/.viben` |
| `VIBEN_CONFIG_PATH` | Path to the global config file | `~/.viben/config.yaml` |
| `VIBEN_AGENT` | Current agent ID to use | `main` |
| `VIBEN_SCOPE` | Configuration scope (`global` or `workspace`) | Auto-detected |

### Setting Environment Variables

```bash
# Set state directory
export VIBEN_STATE_DIR="$HOME/.viben"

# Use a specific agent
export VIBEN_AGENT="my-agent"

# Force global scope
export VIBEN_SCOPE="global"
```

## Global Configuration File

The main configuration file at `~/.viben/config.yaml`:

```yaml
# ~/.viben/config.yaml
version: 1

# General settings
settings:
  editor: code          # Default editor for viben config edit
  pager: less           # Pager for long output
  color: auto           # Color output: auto, always, never

# Agent references
agents:
  - claude-code
  - cursor

# Default MCP servers (enabled globally)
mcp:
  enabled:
    - filesystem
    - git
  disabled:
    - browser

# Default skills
skills:
  enabled:
    - code-review
    - commit
```

## Scope Resolution

The CLI automatically determines which configuration to use based on context:

### Priority (Highest to Lowest)

1. **Command-line flags** (`--global` or `--workspace`)
2. **Environment variable** (`VIBEN_SCOPE`)
3. **Auto-detection**:
   - If `.viben/` exists in current directory or any ancestor directory: `workspace`
   - Otherwise: `global`

### Examples

```bash
# Auto-detect scope (workspace if .viben/ exists, otherwise global)
viben config list

# Force global scope
viben config list --global
viben config list -g

# Force workspace scope
viben config list --workspace
```

### Configuration Merging

When using workspace scope, configurations are merged with global settings:

```
Priority (highest to lowest):
1. Command-line arguments
2. Workspace config (.viben/config.yaml)
3. Global config (~/.viben/config.yaml)
```

For example, if global config enables `filesystem` MCP and workspace config enables `git` MCP, both will be available.

## Quick Commands

```bash
# Initialize workspace in current directory
viben init

# View all configuration
viben config list

# View configuration with source information
viben config list --show-origin

# Get a specific value
viben config get settings.editor

# Set a value
viben config set settings.editor vim

# Edit configuration file
viben config edit
viben config edit --global
```

## Configuration Files Overview

| File | Purpose | Scope |
|------|---------|-------|
| `config.yaml` | General CLI settings | Global/Workspace |
| `providers.yaml` | API provider credentials | Global only |
| `models.yaml` | Model aliases and fallbacks | Global only |
| `agents/<id>/config.yaml` | Per-agent settings | Global only |
| `mcp/installed.yaml` | Installed MCP servers | Global only |
| `skills/installed.yaml` | Installed skills | Global only |

## Next Steps

- [Config Command](./config-command.md) - Learn git-style configuration management
- [Provider Configuration](./providers.md) - Configure API providers (Anthropic, OpenAI, etc.)
- [Model Configuration](./models.md) - Set up model aliases and fallbacks
