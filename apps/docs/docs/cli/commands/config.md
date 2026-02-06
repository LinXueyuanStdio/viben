---
sidebar_position: 3
title: "viben config"
description: "Git-style configuration management for Viben"
---

# viben config

Configuration management following git config conventions.

## Usage

```bash
viben config <subcommand> [options]
```

## Subcommands

| Subcommand | Description |
|------------|-------------|
| `get <key>` | Get a configuration value |
| `set <key> <value>` | Set a configuration value |
| `list` | List all configuration values |
| `edit` | Open configuration in editor |
| `unset <key>` | Remove a configuration value |

## Key Format

Configuration keys use dot notation:

- `settings.editor` - Editor setting
- `settings.pager` - Pager setting
- `mcp.enabled[0]` - First enabled MCP
- `skills.enabled` - List of enabled skills

## Commands

### Get Configuration

Retrieve a configuration value:

```bash
# Get editor setting
viben config get settings.editor

# Get from global config
viben config get --global mcp.enabled

# Get from workspace config
viben config get --workspace settings.color
```

**Output:**

```
code
```

**JSON output:**

```bash
viben config get settings.editor --json
```

```json
{
  "success": true,
  "data": {
    "key": "settings.editor",
    "value": "code"
  }
}
```

### Set Configuration

Set a configuration value:

```bash
# Set editor
viben config set settings.editor vim

# Set global pager
viben config set --global settings.pager less

# Set workspace color mode
viben config set --workspace settings.color auto

# Set a list value
viben config set mcp.enabled '["filesystem", "git"]'
```

**Output:**

```
Set settings.editor = vim
```

**JSON output:**

```json
{
  "success": true,
  "data": {
    "key": "settings.editor",
    "value": "vim"
  }
}
```

### List Configuration

List all configuration values:

```bash
# List merged configuration
viben config list

# List global configuration only
viben config list --global

# List workspace configuration only
viben config list --workspace

# Show configuration origin
viben config list --show-origin
```

**Output:**

```
settings.editor=code
settings.pager=less
settings.color=auto
mcp.enabled=["filesystem", "git"]
mcp.disabled=["browser"]
skills.enabled=["code-review", "commit"]
```

**With `--show-origin`:**

```
global  settings.editor=code
global  settings.pager=less
local   settings.color=auto
global  mcp.enabled=["filesystem", "git"]
```

**JSON output:**

```json
{
  "success": true,
  "data": {
    "config": {
      "settings": {
        "editor": "code",
        "pager": "less",
        "color": "auto"
      },
      "mcp": {
        "enabled": ["filesystem", "git"],
        "disabled": ["browser"]
      },
      "skills": {
        "enabled": ["code-review", "commit"]
      }
    }
  }
}
```

### Edit Configuration

Open configuration file in editor:

```bash
# Edit merged/default config
viben config edit

# Edit global config
viben config edit --global

# Edit workspace config
viben config edit --workspace
```

This opens the configuration file in the editor specified by `settings.editor` or the `EDITOR` environment variable.

### Unset Configuration

Remove a configuration value:

```bash
# Remove a key
viben config unset settings.pager

# Remove from global config
viben config unset --global mcp.disabled
```

**Output:**

```
Removed settings.pager
```

**JSON output:**

```json
{
  "success": true,
  "data": {
    "key": "settings.pager",
    "removed": true
  }
}
```

## Configuration Scope

Configuration is resolved in the following order (highest priority first):

1. Workspace config (`.viben/config.yaml`)
2. Global config (`~/.viben/config.yaml`)
3. Default values

### Examples

```bash
# Set editor globally
viben config set --global settings.editor vim

# Override editor in workspace
viben config set --workspace settings.editor code

# Now workspace uses 'code', other workspaces use 'vim'
```

## Common Configuration Keys

| Key | Type | Description | Default |
|-----|------|-------------|---------|
| `settings.editor` | string | Text editor command | `code` |
| `settings.pager` | string | Pager command | `less` |
| `settings.color` | string | Color output mode | `auto` |
| `mcp.enabled` | string[] | Enabled MCP servers | `[]` |
| `mcp.disabled` | string[] | Disabled MCP servers | `[]` |
| `skills.enabled` | string[] | Enabled skills | `[]` |

## Error Handling

### Key Not Found

```bash
viben config get nonexistent.key
```

```json
{
  "success": false,
  "error": {
    "code": "KEY_NOT_FOUND",
    "message": "Configuration key 'nonexistent.key' not found"
  }
}
```

### Invalid Value

```bash
viben config set settings.color invalid
```

```json
{
  "success": false,
  "error": {
    "code": "INVALID_VALUE",
    "message": "Invalid value 'invalid' for key 'settings.color'. Expected: auto, always, never"
  }
}
```

## Related Commands

- [viben init](./init) - Initialize workspace
- [viben workspace](./workspace) - Workspace operations
- [viben agent config](./agent) - Agent-specific configuration
