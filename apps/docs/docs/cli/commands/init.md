---
sidebar_position: 2
title: "viben init"
description: "Initialize a Viben workspace in the current directory"
---

# viben init

Initialize a Viben workspace in the current directory.

## Usage

```bash
viben init [options]
```

## Options

| Option | Description |
|--------|-------------|
| `--from <template>` | Initialize from a template |

## Examples

### Basic Initialization

Create a new workspace with default configuration:

```bash
viben init
```

**Output (Human-readable):**

```
Initialized Viben workspace in /path/to/project
  Created .viben/config.yaml

Next steps:
  viben mcp install <name>    # Install MCP servers
  viben skill install <name>  # Install skills
```

**Output (JSON):**

```bash
viben init --json
```

```json
{
  "success": true,
  "path": "/path/to/project/.viben",
  "files": ["config.yaml"]
}
```

### Initialize from Template

Create a workspace from a predefined template:

```bash
viben init --from my-template
```

## What Gets Created

The `init` command creates the following structure:

```
<project>/
  .viben/
    config.yaml       # Workspace configuration
```

### Default config.yaml

```yaml
version: 1

# Workspace settings (overrides global configuration)
settings:
  # Inherited from global configuration

# MCP servers for this workspace
mcp:
  enabled: []
  disabled: []

# Skills for this workspace
skills:
  enabled: []
```

## Behavior

1. Check if `.viben/` already exists
2. If exists, print a warning and exit
3. Create `.viben/` directory
4. Create `config.yaml` with default settings
5. Print next steps

## Error Handling

### Workspace Already Exists

```bash
viben init
```

```
Error: Workspace already initialized at /path/to/project/.viben
```

JSON Output:

```json
{
  "success": false,
  "error": {
    "code": "WORKSPACE_EXISTS",
    "message": "Workspace already initialized at /path/to/project/.viben"
  }
}
```

### Permission Denied

```json
{
  "success": false,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "Cannot create .viben directory: permission denied"
  }
}
```

## Related Commands

- [viben workspace](./workspace) - Workspace operations
- [viben config](./config) - Configuration management
- [viben mcp](./mcp) - MCP server management
- [viben team](./team) - Team workspace initialization
