---
sidebar_position: 6
title: "viben skill"
description: "Manage skills - install, uninstall, and list available skills"
---

# viben skill

Manage skills for Viben agents.

## Usage

```bash
viben skill <subcommand> [options]
```

## Subcommands

| Subcommand | Description |
|------------|-------------|
| `install <name>` | Install a skill |
| `uninstall <name>` | Uninstall a skill |
| `list` | List installed skills |

## Commands

### Install Skill

Install a skill from the marketplace:

```bash
# Install latest version
viben skill install code-review

# Install specific version
viben skill install code-review@1.0.0

# Install to a specific agent
viben skill install code-review -n my-agent
```

**Output (Human-readable):**

```
Installing code-review@1.0.0...
Installed code-review v1.0.0
```

**Output (JSON):**

```bash
viben skill install code-review --json
```

```json
{
  "success": true,
  "data": {
    "name": "code-review",
    "version": "1.0.0",
    "path": "~/.viben/skills/code-review/"
  }
}
```

### Uninstall Skill

Remove an installed skill:

```bash
viben skill uninstall code-review
```

**Output:**

```
Uninstalled code-review
```

**JSON Output:**

```json
{
  "success": true,
  "data": {
    "name": "code-review",
    "removed": true
  }
}
```

### List Skills

List installed skills:

```bash
# List installed skills
viben skill list

# List available skills from marketplace
viben skill list --available
```

**Output (Human-readable):**

```
Installed Skills:
  code-review     v1.0.0    Code review assistance
  commit          v1.2.0    Smart commit messages
  test-runner     v0.9.0    Test execution helper
```

**Output (JSON):**

```bash
viben skill list --json
```

```json
{
  "success": true,
  "data": {
    "installed": [
      {
        "name": "code-review",
        "version": "1.0.0",
        "description": "Code review assistance"
      },
      {
        "name": "commit",
        "version": "1.2.0",
        "description": "Smart commit messages"
      },
      {
        "name": "test-runner",
        "version": "0.9.0",
        "description": "Test execution helper"
      }
    ]
  }
}
```

## Skill Scopes

Skills can be installed at different scopes:

| Location | Description |
|----------|-------------|
| `~/.viben/skills/` | Shared skills (available to all agents) |
| `~/.viben/agents/<id>/skills/` | Agent-specific skills |

### Examples

```bash
# Install to shared skills (default)
viben skill install code-review

# Install to a specific agent
viben skill install code-review -n my-agent

# List skills for a specific agent
viben skill list -n my-agent
```

## Skill Configuration

Skills are managed in `~/.viben/skills/installed.yaml`:

```yaml
version: 1

installed:
  code-review:
    version: "1.0.0"
    installed_at: "2024-01-15T10:30:00Z"
  commit:
    version: "1.2.0"
    installed_at: "2024-01-14T09:00:00Z"
  test-runner:
    version: "0.9.0"
    installed_at: "2024-01-10T14:00:00Z"
```

## Error Handling

### Skill Not Found

```bash
viben skill install unknown-skill
```

```json
{
  "success": false,
  "error": {
    "code": "SKILL_NOT_FOUND",
    "message": "Skill 'unknown-skill' not found in marketplace"
  }
}
```

### Already Installed

```bash
viben skill install code-review
```

```json
{
  "success": false,
  "error": {
    "code": "ALREADY_INSTALLED",
    "message": "Skill 'code-review' is already installed (v1.0.0)"
  }
}
```

### Not Installed

```bash
viben skill uninstall unknown-skill
```

```json
{
  "success": false,
  "error": {
    "code": "NOT_INSTALLED",
    "message": "Skill 'unknown-skill' is not installed"
  }
}
```

## Related Commands

- [viben mcp](./mcp) - MCP server management
- [viben agent](./agent) - Agent management
- [viben config](./config) - Configuration management
