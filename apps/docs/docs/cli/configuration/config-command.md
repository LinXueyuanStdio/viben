---
sidebar_position: 2
title: "Config Command"
description: "Git-style configuration management with viben config command"
---

# Config Command

The `viben config` command provides git-style configuration management. It allows you to read, write, list, and edit configuration values using familiar syntax.

## Command Overview

```bash
viben config <subcommand> [options]

Subcommands:
  get       Get a configuration value
  set       Set a configuration value
  list      List all configuration values
  edit      Open configuration file in editor
  unset     Remove a configuration value
```

## Reading Configuration

### Get a Single Value

```bash
viben config get <key>
```

**Examples:**

```bash
# Get the default editor
viben config get settings.editor
# Output: code

# Get global setting
viben config get --global settings.pager
# Output: less

# Get from workspace
viben config get --workspace mcp.enabled
# Output: ["filesystem", "git"]
```

### Key Format

Configuration keys use dot notation to access nested values:

| Key | Description |
|-----|-------------|
| `settings.editor` | Default editor |
| `settings.pager` | Output pager |
| `settings.color` | Color mode |
| `mcp.enabled` | Enabled MCP servers |
| `mcp.disabled` | Disabled MCP servers |
| `skills.enabled` | Enabled skills |

For array access, use bracket notation:

```bash
# Get first enabled MCP
viben config get mcp.enabled[0]

# Get second agent reference
viben config get agents[1]
```

## Writing Configuration

### Set a Value

```bash
viben config set <key> <value>
```

**Examples:**

```bash
# Set editor
viben config set settings.editor vim

# Set pager globally
viben config set --global settings.pager less

# Set color mode
viben config set settings.color always
```

### Setting Complex Values

For arrays and objects, use JSON format:

```bash
# Set enabled MCP servers
viben config set mcp.enabled '["filesystem", "git", "browser"]'

# Set multiple skills
viben config set skills.enabled '["code-review", "commit", "test-runner"]'
```

### Scope Options

| Option | Description |
|--------|-------------|
| `--global`, `-g` | Write to global config (`~/.viben/config.yaml`) |
| `--workspace` | Write to workspace config (`.viben/config.yaml`) |

```bash
# Set in global config
viben config set --global settings.editor code

# Set in workspace config
viben config set --workspace mcp.enabled '["filesystem"]'
```

## Listing Configuration

### List All Values

```bash
viben config list
```

**Output:**

```
settings.editor=code
settings.pager=less
settings.color=auto
mcp.enabled=["filesystem","git"]
mcp.disabled=["browser"]
skills.enabled=["code-review","commit"]
```

### Show Configuration Origin

Use `--show-origin` to see where each value comes from:

```bash
viben config list --show-origin
```

**Output:**

```
global    settings.editor=code
global    settings.pager=less
workspace settings.color=always
workspace mcp.enabled=["filesystem","git","browser"]
global    mcp.disabled=["browser"]
global    skills.enabled=["code-review","commit"]
```

### Scope-Specific Listing

```bash
# List only global configuration
viben config list --global

# List only workspace configuration
viben config list --workspace
```

## Editing Configuration

### Open in Editor

```bash
viben config edit
```

This opens the configuration file in your default editor (set by `settings.editor` or `$EDITOR`).

### Edit Specific Scope

```bash
# Edit global config
viben config edit --global

# Edit workspace config
viben config edit --workspace
```

### Editor Priority

The editor is selected in this order:

1. `settings.editor` from config
2. `$VISUAL` environment variable
3. `$EDITOR` environment variable
4. `vi` (fallback)

## Removing Configuration

### Unset a Value

```bash
viben config unset <key>
```

**Examples:**

```bash
# Remove a setting
viben config unset settings.pager

# Remove from global config
viben config unset --global mcp.disabled
```

:::warning
Unsetting a workspace value reveals the underlying global value. To truly disable something at workspace level, set it to an empty value instead.
:::

## JSON Output

All config commands support `--json` for structured output:

```bash
viben config list --json
```

**Output:**

```json
{
  "success": true,
  "data": {
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
```

```bash
viben config get settings.editor --json
```

**Output:**

```json
{
  "success": true,
  "data": {
    "key": "settings.editor",
    "value": "code",
    "origin": "global"
  }
}
```

## Common Use Cases

### Initial Setup

```bash
# Set your preferred editor
viben config set --global settings.editor code

# Enable color output
viben config set --global settings.color always

# Set default MCP servers
viben config set --global mcp.enabled '["filesystem", "git"]'
```

### Per-Project Configuration

```bash
# Initialize workspace
viben init

# Enable additional MCP for this project
viben config set --workspace mcp.enabled '["filesystem", "git", "browser"]'

# Disable certain skills for this project
viben config set --workspace skills.disabled '["commit"]'
```

### Debugging Configuration Issues

```bash
# See all config with origins
viben config list --show-origin

# Check effective value
viben config get mcp.enabled

# Verify scope detection
viben config list --json | jq '.data'
```

## Error Handling

### Invalid Key

```bash
viben config get nonexistent.key
```

**Output:**

```json
{
  "success": false,
  "error": {
    "code": "KEY_NOT_FOUND",
    "message": "Configuration key 'nonexistent.key' not found"
  }
}
```

### Invalid Value Format

```bash
viben config set mcp.enabled "not-valid-json"
```

**Output:**

```json
{
  "success": false,
  "error": {
    "code": "INVALID_VALUE",
    "message": "Value for 'mcp.enabled' must be a valid JSON array"
  }
}
```

## Next Steps

- [Provider Configuration](/docs/cli/configuration/providers) - Configure API providers
- [Model Configuration](/docs/cli/configuration/models) - Set up model aliases and fallbacks
