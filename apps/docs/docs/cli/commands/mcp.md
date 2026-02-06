---
sidebar_position: 5
title: "viben mcp"
description: "Manage MCP servers - install, configure, enable/disable"
---

# viben mcp

Manage MCP (Model Context Protocol) servers.

## Usage

```bash
viben mcp <subcommand> [options]
```

## Subcommands

| Subcommand | Description |
|------------|-------------|
| `install <name>` | Install an MCP server |
| `uninstall <name>` | Uninstall an MCP server |
| `list` | List installed MCP servers |
| `enable <name>` | Enable an MCP server |
| `disable <name>` | Disable an MCP server |
| `config <name>` | View or set MCP configuration |

## Commands

### Install MCP Server

Install an MCP server from the marketplace:

```bash
# Install latest version
viben mcp install filesystem

# Install specific version
viben mcp install filesystem@1.2.0

# Install to workspace only
viben mcp install filesystem --workspace
```

**Output (Human-readable):**

```
Installing filesystem@1.2.0...
Installed filesystem v1.2.0
```

**Output (JSON):**

```bash
viben mcp install filesystem --json
```

```json
{
  "success": true,
  "data": {
    "name": "filesystem",
    "version": "1.2.0",
    "path": "~/.viben/mcp/filesystem/"
  }
}
```

### Uninstall MCP Server

Remove an installed MCP server:

```bash
viben mcp uninstall filesystem
```

**Output:**

```
Uninstalled filesystem
```

**JSON output:**

```json
{
  "success": true,
  "data": {
    "name": "filesystem",
    "removed": true
  }
}
```

### List MCP Servers

List installed MCP servers:

```bash
# List installed MCPs
viben mcp list

# List available MCPs from marketplace
viben mcp list --available
```

**Output (Human-readable):**

```
Installed MCP Servers:
  filesystem    v1.2.0    enabled    Local filesystem access
  git           v2.0.1    enabled    Git operations
  browser       v1.0.0    disabled   Browser automation
```

**Output (JSON):**

```bash
viben mcp list --json
```

```json
{
  "success": true,
  "data": {
    "installed": [
      {
        "name": "filesystem",
        "version": "1.2.0",
        "status": "enabled",
        "description": "Local filesystem access"
      },
      {
        "name": "git",
        "version": "2.0.1",
        "status": "enabled",
        "description": "Git operations"
      },
      {
        "name": "browser",
        "version": "1.0.0",
        "status": "disabled",
        "description": "Browser automation"
      }
    ]
  }
}
```

### Enable MCP Server

Enable an installed MCP server:

```bash
viben mcp enable filesystem
```

**Output:**

```
Enabled filesystem
```

**JSON output:**

```json
{
  "success": true,
  "data": {
    "name": "filesystem",
    "status": "enabled"
  }
}
```

### Disable MCP Server

Disable an MCP server without uninstalling:

```bash
viben mcp disable browser
```

**Output:**

```
Disabled browser
```

**JSON output:**

```json
{
  "success": true,
  "data": {
    "name": "browser",
    "status": "disabled"
  }
}
```

### Configure MCP Server

View or modify MCP server configuration:

```bash
# View configuration
viben mcp config filesystem

# Set configuration value
viben mcp config filesystem set root /path/to/dir

# Set multiple values
viben mcp config filesystem set allowed_dirs '["~/Documents", "~/Projects"]'
```

**Output (View):**

```
MCP Configuration: filesystem

root: /home/user
allowed_dirs:
  - /home/user/Documents
  - /home/user/Projects
read_only: false
```

**Output (Set):**

```
Set filesystem.root = /path/to/dir
```

**JSON output:**

```json
{
  "success": true,
  "data": {
    "name": "filesystem",
    "config": {
      "root": "/path/to/dir",
      "allowed_dirs": ["/home/user/Documents", "/home/user/Projects"],
      "read_only": false
    }
  }
}
```

## MCP Server Configuration File

MCP servers are configured in `~/.viben/mcp/<name>/config.yaml` or via `mcp_servers.json`:

### YAML Format

```yaml
# ~/.viben/mcp/filesystem/config.yaml
version: 1
name: filesystem
enabled: true
config:
  root: /home/user
  allowed_dirs:
    - /home/user/Documents
    - /home/user/Projects
  read_only: false
```

### JSON Format (mcp_servers.json)

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-filesystem"],
      "env": {
        "ROOT": "/path/to/workspace"
      }
    },
    "git": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-git"]
    }
  }
}
```

## Scope

MCP servers can be installed globally or per-workspace:

| Location | Description |
|----------|-------------|
| `~/.viben/mcp/` | Global MCP servers (all workspaces) |
| `<project>/.viben/mcp/` | Workspace-specific MCP servers |

```bash
# Install globally (default)
viben mcp install filesystem

# Install for workspace only
viben mcp install filesystem --workspace
```

## Error Handling

### MCP Not Found

```bash
viben mcp install unknown-mcp
```

```json
{
  "success": false,
  "error": {
    "code": "MCP_NOT_FOUND",
    "message": "MCP server 'unknown-mcp' not found in marketplace"
  }
}
```

### Already Installed

```bash
viben mcp install filesystem
```

```json
{
  "success": false,
  "error": {
    "code": "ALREADY_INSTALLED",
    "message": "MCP server 'filesystem' is already installed (v1.2.0)"
  }
}
```

### Not Installed

```bash
viben mcp enable unknown-mcp
```

```json
{
  "success": false,
  "error": {
    "code": "NOT_INSTALLED",
    "message": "MCP server 'unknown-mcp' is not installed"
  }
}
```

## Related Commands

- [viben service](./service) - Service management
- [viben config](./config) - Configuration management
- [viben agent](./agent) - Agent management
