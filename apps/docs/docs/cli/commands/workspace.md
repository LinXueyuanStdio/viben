---
sidebar_position: 7
title: "viben workspace"
description: "Workspace operations - list and view workspace information"
---

# viben workspace

Viben workspace operations.

## Usage

```bash
viben workspace <subcommand> [options]
```

## Subcommands

| Subcommand | Description |
|------------|-------------|
| `list` | List all known workspaces |
| `current` | Show current workspace information |

## Commands

### List Workspaces

List all known workspaces:

```bash
viben workspace list
```

**Output (human-readable):**

```
Known Workspaces:
  /Users/xxx/projects/viben      2 MCPs    3 skills   last used: 2h ago
  /Users/xxx/projects/my-app     1 MCP     1 skill    last used: 1d ago
  /Users/xxx/projects/docs       0 MCPs    0 skills   last used: 3d ago
```

**Output (JSON):**

```bash
viben workspace list --json
```

```json
{
  "success": true,
  "data": {
    "workspaces": [
      {
        "path": "/Users/xxx/projects/viben",
        "mcp_count": 2,
        "skill_count": 3,
        "last_used": "2024-01-16T08:30:00Z"
      },
      {
        "path": "/Users/xxx/projects/my-app",
        "mcp_count": 1,
        "skill_count": 1,
        "last_used": "2024-01-15T10:00:00Z"
      },
      {
        "path": "/Users/xxx/projects/docs",
        "mcp_count": 0,
        "skill_count": 0,
        "last_used": "2024-01-13T14:00:00Z"
      }
    ]
  }
}
```

### Current Workspace

Show current workspace information:

```bash
viben workspace current
```

**Output (human-readable):**

```
Current Workspace:
  Path: /Users/xxx/projects/viben
  MCP:  filesystem, git (2 enabled)
  Skills: code-review, commit (2 enabled)
```

**Output (JSON):**

```bash
viben workspace current --json
```

```json
{
  "success": true,
  "data": {
    "path": "/Users/xxx/projects/viben",
    "mcp": {
      "enabled": ["filesystem", "git"],
      "disabled": []
    },
    "skills": {
      "enabled": ["code-review", "commit"]
    }
  }
}
```

## Workspace Structure

A workspace is a directory containing a `.viben/` folder:

```
<project>/
  .viben/
    config.yaml           # Workspace configuration
  .claude/                # Claude Code workspace configuration (overlay at runtime)
  .cursor/                # Cursor workspace configuration (overlay at runtime)
  ...                     # Other agent type configurations
```

### Workspace Configuration

```yaml
# <project>/.viben/config.yaml
version: 1

# Override global settings
settings:
  color: always

# Workspace-specific MCPs
mcp:
  enabled:
    - filesystem
    - git
  disabled: []

# Workspace-specific skills
skills:
  enabled:
    - code-review
    - commit
```

## Error Handling

### Not in a Workspace

```bash
viben workspace current
```

When not in a workspace directory:

```json
{
  "success": false,
  "error": {
    "code": "NOT_IN_WORKSPACE",
    "message": "Current directory is not a Viben workspace. Run 'viben init' to initialize."
  }
}
```

### No Workspaces Found

```bash
viben workspace list
```

When there are no registered workspaces:

```json
{
  "success": true,
  "data": {
    "workspaces": []
  }
}
```

Human-readable output:

```
No workspaces found. Run 'viben init' in a project directory to create one.
```

## Related Commands

- [viben init](./init) - Initialize a workspace
- [viben config](./config) - Configuration management
- [viben mcp](./mcp) - MCP server management
- [viben skill](./skill) - Skill management
